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
    this.errors = new ErrorMessages();
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
    await Promise.all(
      this.tasks.map((task) => {
        task.stop();
      }),
    );
    this.inbox.removeAllListeners('message');
    this.outbox.removeAllListeners('message');
    this.status.removeAllListeners('started');
    this.status.removeAllListeners('stopped');
    logger.info(`🔴 Stopped ${this.config.icon} ${this.user.firstName} (@${this.user.username}) [${this.user.id}]`);
  }

  async stop(): Promise<void> {
    try {
      await this.bindings.stop();
    } catch (e) {
      catchException(e, this);
    }
  }

  messageSender({ conversation, content }: Message): void {
    logger.info(
      `💬 ${this.config.icon} [${conversation.id}] ${conversation.title} 🗣️ ${getFullName(this.user.id)} [${
        this.user.id
      }]: ${content}`,
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

  async webhookHandler(req: IncomingMessage, res: ServerResponse, data: string): Promise<void> {
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
      this.plugins.map(async (plugin) => {
        if (getPluginSlug(plugin) == path[2] && plugin.webhook) {
          await plugin.webhook(req.url, dataObject);
        }
      });
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
    Object.keys(plugins).map((name) => {
      if (this.checkIfPluginIsEnabled(name)) {
        const plugin = new plugins[name](this);
        // Check if plugin works only with certain bindings
        if (plugin.bindings == undefined || plugin.bindings.indexOf(this.config.bindings) > -1) {
          this.plugins.push(plugin);
        }
      }
    });
    logger.info(`✅ Loaded ${this.plugins.length}/${Object.keys(plugins).length} plugins for "${this.config.name}"`);
  }

  checkIfPluginIsEnabled(name: string): boolean {
    let enabled = false;
    if (this.config.plugins === '*' || (Array.isArray(this.config.plugins) && this.config.plugins.includes(name))) {
      enabled = true;
    }
    if (Array.isArray(this.config.plugins) && !this.config.excludedPlugins.includes(name)) {
      enabled = false;
    }
    return enabled;
  }

  initTranslations(): void {
    if (db.translations && db.translations[this.config.translation]) {
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
      this.plugins.map((plugin) => {
        if (trans.plugins[plugin.constructor.name]) {
          if (plugin.commands) {
            let maxLength = plugin.commands.length;
            if (
              trans.plugins[plugin.constructor.name].commands &&
              Object.keys(trans.plugins[plugin.constructor.name].commands).length > maxLength
            ) {
              maxLength = Object.keys(trans.plugins[plugin.constructor.name].commands).length;
            }
            for (let commandIndex = 0; commandIndex < maxLength; commandIndex++) {
              if (trans.plugins[plugin.constructor.name].commands) {
                if (trans.plugins[plugin.constructor.name].commands[commandIndex]) {
                  const com = trans.plugins[plugin.constructor.name].commands[commandIndex];
                  if (plugin.commands[commandIndex] == undefined) {
                    plugin.commands[commandIndex] = { ...com };
                  }
                  if (com.command) {
                    plugin.commands[commandIndex].command = com.command;
                  }
                  if (com.shortcut) {
                    plugin.commands[commandIndex].shortcut = com.shortcut;
                  }
                  if (com.aliases) {
                    plugin.commands[commandIndex].aliases = [];
                    Object.keys(com.aliases).map((alias) => {
                      plugin.commands[commandIndex].aliases[alias] = com.aliases[alias];
                    });
                  }
                  if (com.friendly) {
                    plugin.commands[commandIndex].friendly = com.friendly;
                  }
                  if (com.description) {
                    plugin.commands[commandIndex].description = com.description;
                  }
                  if (com.keepDefault != undefined) {
                    plugin.commands[commandIndex].keepDefault = com.keepDefault;
                  }
                  if (com.hidden != undefined) {
                    plugin.commands[commandIndex].hidden = com.hidden;
                  }
                  if (com.skipHelp != undefined) {
                    plugin.commands[commandIndex].skipHelp = com.skipHelp;
                  }
                  if (com.parameters) {
                    plugin.commands[commandIndex].parameters = [];
                    Object.keys(com.parameters).map((param) => {
                      plugin.commands[commandIndex].parameters[param] = com.parameters[param];
                    });
                  }
                }
              }
            }
          }
          if (plugin.strings) {
            plugin.strings = { ...plugin.strings, ...trans.plugins[plugin.constructor.name].strings };
          }
          if (plugin.data) {
            plugin.data = trans.plugins[plugin.constructor.name].data;
          }
          plugin.afterTranslation();
        }
      });
    }
  }

  scheduleCronJobs(): void {
    this.plugins.map(async (plugin) => {
      if (plugin.cronExpression && plugin.cron) {
        this.tasks.push(
          cron.schedule(plugin.cronExpression, async () => {
            logger.debug(`Running ${plugin.constructor.name} cron job of @${this.user.username}`);
            await plugin.cron();
          }),
        );
      }
    });
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

      for (const plugin of this.plugins) {
        if (plugin.always) {
          await plugin.always(msg);
        }
        if (plugin.commands && !ignoreMessage) {
          for (const command of plugin.commands) {
            if (command.command) {
              if (await this.checkTrigger(command.command, command.parameters, msg, plugin)) {
                break;
              }

              if (command.keepDefault != undefined && command.keepDefault) {
                if (await this.checkTrigger(command.command, command.parameters, msg, plugin, false, true)) {
                  break;
                }
              }
            }

            if (
              command.friendly &&
              !hasTag(this, msg.sender.id, 'noreplies') &&
              !hasTag(this, msg.conversation.id, 'noreplies') &&
              msg.conversation.id != +this.config.alertsConversationId &&
              msg.conversation.id != +this.config.adminConversationId
            ) {
              if (await this.checkTrigger(command.friendly, command.parameters, msg, plugin, true)) {
                break;
              }
            }

            if (command.shortcut) {
              if (await this.checkTrigger(command.shortcut, command.parameters, msg, plugin)) {
                break;
              }

              if (command.keepDefault != undefined && command.keepDefault) {
                if (await this.checkTrigger(command.shortcut, command.parameters, msg, plugin, false, true)) {
                  break;
                }
              }
            }

            if (command.aliases) {
              for (const alias of command.aliases) {
                if (await this.checkTrigger(alias, command.parameters, msg, plugin)) {
                  break;
                }

                if (command.keepDefault != undefined && command.keepDefault) {
                  if (await this.checkTrigger(alias, command.parameters, msg, plugin, false, true)) {
                    break;
                  }
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
          parameters &&
          message.content &&
          typeof message.content == 'string' &&
          message.content.indexOf(' ') == -1
        ) {
          trigger += '$';
        } else if (
          parameters &&
          message.content &&
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
    if (!extra.format) {
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
    if (msg.extra.originalMessage) {
      extra.originalMessage = msg.extra.originalMessage;
    }
    this.sendMessage(msg.conversation, content, type, reply, extra);
  }

  sendAlert(text: string, language = 'javascript'): void {
    if (this.config.alertsConversationId) {
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
  }

  sendAdminAlert(text: string): void {
    if (this.config.adminConversationId) {
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
}
