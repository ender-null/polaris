import { EventEmitter } from 'events';
import { IncomingMessage, ServerResponse } from 'http';
import * as cron from 'node-cron';
import os from 'os';
import {
  BindingsBase,
  Config,
  Conversation,
  ErrorMessages,
  Extra,
  Message,
  Parameter,
  PluginBase,
  Translation,
  User,
} from '.';
import * as bindings from './bindings/index';
import { db } from './main';
import * as plugins from './plugins/index';
import { Errors } from './types';
import {
  catchException,
  escapeRegExp,
  getFullName,
  getPluginSlug,
  hasTag,
  isTrusted,
  logger,
  merge,
  now,
  setInput,
  t,
} from './utils';

export class Bot {
  config: Config;
  bindings: BindingsBase;
  inbox: EventEmitter;
  outbox: EventEmitter;
  status: EventEmitter;
  started: boolean;
  plugins: PluginBase[];
  tasks: cron.Task[];
  user: User;
  errors: ErrorMessages;

  constructor(config: Config) {
    this.inbox = new EventEmitter();
    this.outbox = new EventEmitter();
    this.status = new EventEmitter();
    this.config = config;
    this.bindings = new bindings[this.config.bindings](this);
    this.plugins = [];
    this.tasks = [];
    this.errors = new Errors();
  }

  async start(): Promise<void> {
    this.inbox.on('message', (msg: Message) => this.messagesHandler(msg));
    this.outbox.on('message', (msg: Message) => this.messageSender(msg));
    this.initPlugins();
    db.events.on('update:translations', () => this.initTranslations());
    this.status.on('started', () => this.onStarted());
    this.status.on('stopped', () => this.onStopped());
    try {
      await this.bindings.start();
    } catch (e) {
      catchException(e, this);
    }
  }

  async onStarted(): Promise<void> {
    this.started = true;
    this.user = await this.bindings.getMe();
    this.initTranslations();
    logger.info(
      `🟢 Connected as ${this.config.icon} ${this.user.firstName} (@${this.user.username}) [${this.user.id}] from ${os.hostname}`,
    );
    this.scheduleCronJobs();
  }

  async onStopped(): Promise<void> {
    this.started = false;
    for (const task of this.tasks) {
      task.stop();
    }
    this.inbox.removeAllListeners('message');
    this.outbox.removeAllListeners('message');
    this.status.removeAllListeners('started');
    this.status.removeAllListeners('stopped');
    logger.info(
      `🔴 Stopped ${this.config.icon} ${this.user.firstName} (@${this.user.username}) [${this.user.id}] from ${os.hostname}`,
    );
  }

  async stop(): Promise<void> {
    try {
      await this.bindings.stop();
    } catch (e) {
      catchException(e, this);
    }
  }

  messageSender(msg: Message): void {
    logger.info(
      `💬 ${this.config.icon} [${msg.conversation.id}] ${msg.conversation.title} 🗣️ ${getFullName(this.user.id)} [${
        this.user.id
      }]: ${msg.content}`,
    );
  }

  async messagesHandler(msg: Message): Promise<void> {
    if (msg.sender instanceof User) {
      logger.info(
        `${this.getMessageIcon(msg.type)} ${this.config.icon} [${msg.conversation.id}] ${
          msg.conversation.title
        } 👤 ${getFullName(msg.sender.id)} [${msg.sender.id}]: ${msg.content}`,
      );
    } else {
      logger.info(
        `${this.getMessageIcon(msg.type)} ${this.config.icon} [${msg.conversation.id}] ${msg.conversation.title} 👤 ${
          msg.sender.title
        } [${msg.conversation.id}]: ${msg.content}`,
      );
    }

    await this.onMessageReceive(msg);
  }

  async webhookHandler(req: IncomingMessage, res: ServerResponse, data: any): Promise<void> {
    let dataObject;
    try {
      dataObject = JSON.parse(data);
    } catch (e) {
      dataObject = null;
      logger.error(e.message);
    }
    const path = req.url.split('/');
    if (path[2].startsWith('webhook')) {
      await this.bindings.webhookHandler(req, res, dataObject);
    } else {
      logger.info(`☁️ ${this.config.icon} [webhook:${req.url}] ${data}`);
      for (const i in this.plugins) {
        const plugin = this.plugins[i];
        if (getPluginSlug(plugin) == path[2] && 'webhook' in plugin) {
          await plugin.webhook(req.url, dataObject);
        }
      }
    }
  }

  getMessageIcon(type: string): string {
    if (type == 'text') {
      return '🗨️';
    } else if (type == 'photo') {
      return '🖼️';
    } else if (type == 'voice') {
      return '🎵';
    } else if (type == 'audio') {
      return '🎶';
    } else if (type == 'video') {
      return '🎥';
    } else if (type == 'animation') {
      return '🎬';
    } else if (type == 'document') {
      return '📦';
    } else if (type == 'sticker') {
      return '🎭';
    } else if (type == 'unsupported') {
      return '⚠️';
    }
    return type;
  }

  initPlugins(): void {
    this.plugins = [];
    for (const i in plugins) {
      const plugin = new plugins[i](this);
      // Check if plugin works only with certain bindings
      if (plugin.bindings == undefined || plugin.bindings.indexOf(this.config.bindings) > -1) {
        this.plugins.push(plugin);
      }
    }
  }

  initTranslations(): void {
    if (db.translations && this.config.translation in db.translations) {
      let trans: Translation = db.translations[this.config.translation];
      if (trans.extends) {
        let base = db.translations[trans.extends];
        while (base.extends) {
          const inherit = db.translations[base.extends];
          base = merge(inherit, base);
          if (inherit.extends) {
            base.extends = inherit.extends;
          } else {
            delete base.extends;
          }
        }
        trans = merge(base, trans);
      }
      this.errors = trans.errors;
      for (const plugin of this.plugins) {
        if (plugin.constructor.name in trans.plugins) {
          if ('commands' in plugin) {
            let maxlength = plugin.commands.length;
            if (
              'commands' in trans.plugins[plugin.constructor.name] &&
              Object.keys(trans.plugins[plugin.constructor.name].commands).length > maxlength
            ) {
              maxlength = Object.keys(trans.plugins[plugin.constructor.name].commands).length;
            }
            for (let commandIndex = 0; commandIndex < maxlength; commandIndex++) {
              if ('commands' in trans.plugins[plugin.constructor.name]) {
                if (commandIndex in trans.plugins[plugin.constructor.name].commands) {
                  const com = trans.plugins[plugin.constructor.name].commands[commandIndex];
                  if (plugin.commands[commandIndex] == undefined) {
                    plugin.commands[commandIndex] = { ...com };
                  }
                  if ('command' in com) {
                    plugin.commands[commandIndex].command = com.command;
                  }
                  if ('shortcut' in com) {
                    plugin.commands[commandIndex].shortcut = com.shortcut;
                  }
                  if ('friendly' in com) {
                    plugin.commands[commandIndex].friendly = com.friendly;
                  }
                  if ('description' in com) {
                    plugin.commands[commandIndex].description = com.description;
                  }
                  if ('keepDefault' in com) {
                    plugin.commands[commandIndex].keepDefault = com.keepDefault;
                  }
                  if ('hidden' in com) {
                    plugin.commands[commandIndex].hidden = com.hidden;
                  }
                  if ('skipHelp' in com) {
                    plugin.commands[commandIndex].skipHelp = com.skipHelp;
                  }
                  if ('parameters' in com) {
                    plugin.commands[commandIndex].parameters = [];
                    for (const paramIndex in com.parameters) {
                      plugin.commands[commandIndex].parameters[paramIndex] = com.parameters[paramIndex];
                    }
                  }
                }
              }
            }
          }
          if ('strings' in plugin) {
            plugin.strings = { ...plugin.strings, ...trans.plugins[plugin.constructor.name].strings };
          }
          if ('data' in plugin) {
            plugin.data = trans.plugins[plugin.constructor.name].data;
          }
          plugin.afterTranslation();
        }
      }
    }
  }

  scheduleCronJobs(): void {
    for (const plugin of this.plugins) {
      if (plugin.cronExpression && plugin.cron) {
        this.tasks.push(
          cron.schedule(plugin.cronExpression, async () => {
            logger.debug(`Running ${plugin.constructor.name} cron job of @${this.user.username}`);
            await plugin.cron();
          }),
        );
      }
    }
  }

  async onMessageReceive(msg: Message): Promise<void> {
    try {
      let ignoreMessage = false;
      if (msg.content == null || (msg.type != 'inline_query' && msg.date < now() - 5 * t.minute)) {
        return;
      }

      if (msg.type != 'text' || msg.sender['isBot']) {
        ignoreMessage = true;
      }

      if (
        msg.sender.id != +this.config.owner &&
        !isTrusted(this, msg.sender.id, msg) &&
        (hasTag(this, msg.conversation.id, 'muted') || hasTag(this, msg.sender.id, 'muted'))
      ) {
        ignoreMessage = true;
      }

      for (const i in this.plugins) {
        const plugin = this.plugins[i];
        if ('always' in plugin) {
          plugin.always(msg);
        }
        if ('commands' in plugin && !ignoreMessage) {
          for (const i in plugin.commands) {
            const command = plugin.commands[i];
            if ('command' in command) {
              if (await this.checkTrigger(command.command, command.parameters, msg, plugin)) {
                break;
              }

              if ('keepDefault' in command && command.keepDefault) {
                if (await this.checkTrigger(command.command, command.parameters, msg, plugin, false, true)) {
                  break;
                }
              }
            }

            if (
              'friendly' in command &&
              !hasTag(this, msg.sender.id, 'noreplies') &&
              !hasTag(this, msg.conversation.id, 'noreplies') &&
              msg.conversation.id != +this.config.alertsConversationId &&
              msg.conversation.id != +this.config.adminConversationId
            ) {
              if (await this.checkTrigger(command.friendly, command.parameters, msg, plugin, true)) {
                break;
              }
            }

            if ('shortcut' in command) {
              if (await this.checkTrigger(command.shortcut, command.parameters, msg, plugin)) {
                break;
              }

              if ('keepDefault' in command && command.keepDefault) {
                if (await this.checkTrigger(command.shortcut, command.parameters, msg, plugin, false, true)) {
                  break;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      catchException(e, this, msg);
    }
  }

  async checkTrigger(
    command: string,
    parameters: Parameter[],
    message: Message,
    plugin: PluginBase,
    friendly = false,
    keepDefault = false,
  ): Promise<boolean> {
    command = command.toLowerCase();
    if (
      typeof message.content == 'string' &&
      message.content.endsWith(`@${this.user.username}`) &&
      message.content.indexOf(' ') == -1
    ) {
      message.content = message.content.replace(`@${this.user.username}`, '');
    }

    // If the commands are not /start, /help or /config, set the correct command start symbol.
    let trigger = null;
    if (
      (command == '/start' && message.content.indexOf('/start') > -1) ||
      (command == '/help' && message.content.indexOf('/help') > -1) ||
      (command == '/config' && message.content.indexOf('/config') > -1)
    ) {
      trigger = command.replace('/', '^/');
    } else {
      if (keepDefault) {
        trigger = command.replace('/', '^/');
      } else {
        trigger = command.replace('/', `^${escapeRegExp(this.config.prefix)}`);
      }

      if (!friendly) {
        if (parameters == null && trigger.startsWith('^')) {
          trigger += '$';
        } else if (
          parameters != null &&
          message.content != null &&
          typeof message.content == 'string' &&
          message.content.indexOf(' ') == -1
        ) {
          trigger += '$';
        } else if (
          parameters != null &&
          message.content != null &&
          typeof message.content == 'string' &&
          message.content.indexOf(' ') > -1
        ) {
          trigger += ' ';
        }
      }
    }
    if (message.content && typeof message.content == 'string' && new RegExp(trigger, 'gim').test(message.content)) {
      message = setInput(message, trigger);
      try {
        await plugin.run(message);
      } catch (e) {
        catchException(e, this, message);
      }

      return true;
    }
    return false;
  }

  async getChatAdmins(conversationId: string | number): Promise<User[]> {
    return await this.bindings.getChatAdministrators(conversationId);
  }

  sendMessage(chat: Conversation, content: string, type = 'text', reply?: Message, extra?: Extra): void {
    if (!extra) {
      extra = {};
    }
    if (!('format' in extra)) {
      extra.format = 'HTML';
    }
    const message = new Message(null, chat, this.user, content, type, now(), reply, extra);
    this.outbox.emit('message', message);
  }

  forwardMessage(msg: Message, chatId: number | string): void {
    const message = new Message(null, msg.conversation, this.user, msg.content, 'forward', now(), null, {
      message: msg.id,
      conversation: chatId,
    });
    this.outbox.emit('message', message);
  }

  replyMessage(msg: Message, content: string, type = 'text', reply?: Message, extra?: Extra): void {
    if (!extra) {
      extra = {};
    }
    if (msg.extra.addPing) {
      extra.addPing = msg.extra.addPing;
    }
    this.sendMessage(msg.conversation, content, type, reply, extra);
  }

  sendAlert(text: string, language = 'javascript'): void {
    const message = new Message(
      null,
      new Conversation(this.config.alertsConversationId, 'Alerts'),
      this.user,
      `<code class="language-${language}">${text}</code>`,
      'text',
      null,
      null,
      { format: 'HTML', preview: false },
    );
    this.outbox.emit('message', message);
  }

  sendAdminAlert(text: string): void {
    const message = new Message(
      null,
      new Conversation(this.config.adminConversationId, 'Admin'),
      this.user,
      text,
      'text',
      null,
      null,
      { format: 'HTML', preview: false },
    );
    this.outbox.emit('message', message);
  }
}
