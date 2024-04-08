import { Config } from './config';
import { PluginBase } from './plugin';
import {
  Conversation,
  ErrorMessages,
  Extra,
  Message,
  Parameter,
  Translation,
  User,
  WSCommand,
  WSCommandPayload,
  WSMessage,
} from './types';
import {
  catchException,
  escapeRegExp,
  getFullName,
  getMessageIcon,
  hasTag,
  isTrusted,
  logger,
  merge,
  now,
  setInput,
  t,
} from './utils';
import { WebSocket } from 'ws';
import * as plugins from './plugins/index';
import * as cron from 'node-cron';
import { Actions } from './actions';
import { db } from './main';

export class Bot {
  websocket: WebSocket;
  started: boolean;
  config: Config;
  user: User;
  plugins: PluginBase[];
  tasks: cron.Task[];
  errors: ErrorMessages;
  bindings: Actions;

  constructor(websocket: WebSocket, config: Config, user: User) {
    this.websocket = websocket;
    this.config = config;
    this.user = user;
    this.plugins = [];
    this.tasks = [];
    this.errors = new ErrorMessages();
    this.bindings = new Actions(this);
  }

  messageSender({ conversation, content }: Message): void {
    logger.info(
      `💬 ${this.config.icon} [${conversation.id}] ${conversation.title} 🗣️ ${getFullName(this.user.id)} [${
        this.user.id
      }]: ${content}`,
    );
  }

  commandSender(method: string, payload: WSCommandPayload): void {
    logger.info(`💬 ${this.config.icon} [${method}]: ${payload}`);
  }

  async messagesHandler(msg: Message): Promise<void> {
    if (!msg.conversation.title) {
      logger.info(
        `${getMessageIcon(msg.type)} ${this.config.icon} [${msg.conversation.id}] ${
          msg.conversation.title
        } 👤 ${getFullName(msg.sender.id)} [${msg.sender.id}]: ${msg.content}`,
      );
    } else {
      logger.info(
        `${getMessageIcon(msg.type)} ${this.config.icon} [${msg.conversation.id}] ${msg.conversation.title} 👤 ${
          (msg.sender as Conversation).title
        } [${msg.conversation.id}]: ${msg.content}`,
      );
    }

    await this.onMessageReceive(msg);
  }

  initPlugins(): void {
    this.plugins = [];
    Object.keys(plugins).map((name) => {
      if (this.checkIfPluginIsEnabled(name)) {
        const plugin: PluginBase = new plugins[name](this);
        // Check if plugin works only with certain bindings
        if (plugin.bindings == undefined || plugin.bindings.indexOf(this.config.platform) > -1) {
          this.plugins.push(plugin);
        }
      }
    });
    logger.info(`✅ Loaded ${this.plugins.length}/${Object.keys(plugins).length} plugins for "${this.config.name}"`);
  }

  checkIfPluginIsEnabled(name: string): boolean {
    let enabled = false;
    if (typeof this.config.plugins === 'string' && this.config.plugins === '*') {
      enabled = true;
    }
    if (Array.isArray(this.config.plugins) && this.config.plugins.includes(name)) {
      enabled = true;
    }
    if (Array.isArray(this.config.excludedPlugins) && this.config.excludedPlugins.includes(name)) {
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
              (command.alwaysEnabled ||
                (!hasTag(this, msg.sender.id, 'noreplies') && !hasTag(this, msg.conversation.id, 'noreplies'))) &&
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

  send(msg: Message) {
    this.messageSender(msg);
    const message: WSMessage = {
      bot: this.config.name,
      platform: this.config.platform,
      type: 'message',
      message: msg,
    };
    this.websocket.send(JSON.stringify(message));
  }

  sendCommand(method: string, payload: WSCommandPayload) {
    this.commandSender(method, payload);
    const message: WSCommand = {
      bot: this.config.name,
      platform: this.config.platform,
      type: 'command',
      method,
      payload,
    };
    this.websocket.send(JSON.stringify(message));
  }

  sendMessage(chat: Conversation, content: string, type = 'text', reply?: Message, extra?: Extra): void {
    if (!extra) {
      extra = {};
    }
    if (!extra.format) {
      extra.format = 'HTML';
    }
    const message = new Message(null, chat, this.user, content, type, now(), reply, extra);
    this.send(message);
  }

  forwardMessage(msg: Message, chatId: number | string): void {
    const message = new Message(null, msg.conversation, this.user, msg.content, 'forward', now(), null, {
      message: msg.id,
      conversation: chatId,
    });
    this.send(message);
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
    if (!reply) {
      reply = msg;
    }
    this.sendMessage(msg.conversation, content, type, reply, extra);
  }

  sendAlert(text: string, language = 'javascript'): void {
    if (
      this.config.alertsConversationId &&
      !(text.includes(this.config.alertsConversationId) || text.includes('Chat not found'))
    ) {
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
      this.send(message);
    }
  }

  sendAdminAlert(text: string): void {
    if (
      this.config.adminConversationId &&
      !(text.includes(this.config.adminConversationId) || text.includes('Chat not found'))
    ) {
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
      this.send(message);
    }
  }
}
