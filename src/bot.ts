import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import os from 'os';
import * as bindings from './bindings/index';
import { Errors } from './errors';
import { BindingsBase, Config, Conversation, Database, Extra, Message, PluginBase, User } from './index';
import { Parameter } from './plugin';
import * as plugins from './plugins/index';
import { catchException, hasTag, isTrusted, logger, now, setInput } from './utils';

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
  db: Database;

  constructor(config: Config) {
    this.inbox = new EventEmitter();
    this.outbox = new EventEmitter();
    this.status = new EventEmitter();
    this.config = config;
    this.bindings = new bindings[this.config.bindings](this);
    this.plugins = [];
    this.tasks = [];
  }

  async start(): Promise<void> {
    this.inbox.on('message', (msg: Message) => this.messagesHandler(msg));
    this.outbox.on('message', (msg: Message) => {
      logger.info(
        ` [${this.user.id}] ${this.user.firstName}@${msg.conversation.title} [${msg.conversation.id}] sent [${msg.type}] ${msg.content}`,
      );
    });
    this.initPlugins();
    this.status.on('started', async () => {
      this.started = true;
      this.user = await this.bindings.getMe();
      logger.info(`Connected as ${this.user.firstName} (@${this.user.username}) [${this.user.id}] from ${os.hostname}`);
      this.sendAdminAlert(
        `Connected as ${this.user.firstName} (@${this.user.username}) [${this.user.id}] from ${os.hostname}`,
      );
      this.scheduleCronJobs();
    });
    this.status.on('stopped', async () => {
      this.started = false;
      for (const task of this.tasks) {
        task.stop();
      }
      logger.info(`Stopped ${this.user.firstName} (@${this.user.username}) [${this.user.id}] from ${os.hostname}`);
    });
    try {
      await this.bindings.start();
    } catch (e) {
      catchException(e, this);
    }
  }

  async stop(): Promise<void> {
    await this.bindings.stop();
  }

  messagesHandler(msg: Message): void {
    if (msg.sender instanceof User) {
      logger.info(
        `[${msg.sender.id}] ${msg.sender.firstName}@${msg.conversation.title} [${msg.conversation.id}] sent [${msg.type}] ${msg.content}`,
      );
    } else {
      logger.info(
        `[${msg.sender.id}] ${msg.sender.title}@${msg.conversation.title} [${msg.conversation.id}] sent [${msg.type}] ${msg.content}`,
      );
    }

    this.onMessageReceive(msg);
  }

  initPlugins(): void {
    this.plugins = [];
    for (const plugin in plugins) {
      try {
        this.plugins.push(new plugins[plugin](this));
      } catch (e) {
        catchException(e, this);
      }
    }
  }

  scheduleCronJobs(): void {
    for (const plugin of this.plugins) {
      if ('cronExpression' in plugin && 'cron' in plugin) {
        this.tasks.push(
          cron.schedule(plugin.cronExpression, () => {
            logger.debug(`Running ${plugin.constructor.name} cron job of @${this.user.username}`);
            plugin.cron();
          }),
        );
      }
    }
  }

  onMessageReceive(msg: Message): void {
    try {
      let ignoreMessage = false;
      if (msg.content == null || (msg.type != 'inline_query' && msg.date < now() - 60 * 5)) {
        return;
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
              if (this.checkTrigger(command.command, command.parameters, msg, plugin)) {
                break;
              }

              if ('keepDefault' in command && command.keepDefault) {
                if (this.checkTrigger(command.command, command.parameters, msg, plugin, false, true)) {
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
              if (this.checkTrigger(command.friendly, command.parameters, msg, plugin, true)) {
                break;
              }
            }

            if ('shortcut' in command) {
              if (this.checkTrigger(command.shortcut, command.parameters, msg, plugin)) {
                break;
              }

              if ('keepDefault' in command && command.keepDefault) {
                if (this.checkTrigger(command.shortcut, command.parameters, msg, plugin, false, true)) {
                  break;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      catchException(e, this);
    }
  }

  checkTrigger(
    command: string,
    parameters: Parameter[],
    message: Message,
    plugin: PluginBase,
    friendly = false,
    keepDefault = false,
  ): boolean {
    command = command.toLowerCase();
    if (
      typeof message.content == 'string' &&
      message.content.endsWith(`@${this.user.username}`) &&
      message.content.indexOf(' ') > -1
    ) {
      message.content = message.content.replace('@' + this.user.username, '');
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
        trigger = command.replace('/', `^${this.config.prefix}`);
      }

      if (!friendly) {
        trigger = trigger.replace(`@${this.user.username.toLowerCase()}`, '');
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
        plugin.run(message);
      } catch (e) {
        catchException(e, this);
        this.replyMessage(message, Errors.exceptionFound);
      }

      return true;
    }
    return false;
  }

  sendMessage(chat: Conversation, content: string, type = 'text', reply?: Message, extra?: Extra): void {
    const message = new Message(null, chat, this.user, content, type, null, reply, extra);
    this.outbox.emit('message', message);
  }

  replyMessage(msg: Message, content: string, type = 'text', reply?: Message, extra?: Extra): void {
    const message = new Message(null, msg.conversation, this.user, content, type, null, reply, extra);
    this.outbox.emit('message', message);
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
