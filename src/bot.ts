import { EventEmitter } from 'events';
import * as bindings from './bindings/index';
import { BindingsBase, Config, Extra, Message, PluginBase, User } from './index';
import { logger } from './main';
import * as plugins from './plugins/index';

export class Bot {
  config: Config;
  bindings: BindingsBase;
  inbox: EventEmitter;
  outbox: EventEmitter;
  started: boolean;
  plugins: PluginBase[];
  user: User;

  constructor(config: Config) {
    this.inbox = new EventEmitter();
    this.outbox = new EventEmitter();
    this.config = config;
    this.bindings = new bindings[this.config.bindings](this);
    this.plugins = [];
  }

  async start(): Promise<void> {
    await this.bindings.start();
    this.started = true;
    this.user = await this.bindings.getMe();
    logger.info(`Connected as ${this.user.firstName} (@${this.user.username}) [${this.user.id}]`);
    this.inbox.on('message', (msg: Message) => this.messagesHandler(msg));
    this.outbox.on('message', (msg: Message) => {
      logger.info(
        ` [${this.user.id}] ${this.user.firstName}@${msg.conversation.title} [${msg.conversation.id}] sent [${msg.type}] ${msg.content}`,
      );
    });
    this.initPlugins();
  }

  async stop(): Promise<void> {
    logger.info('stop');
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
    for (const plugin in plugins) {
      if ((this.config.plugins = '*')) {
        this.plugins.push(plugins[plugin]);
      }
    }
  }

  onMessageReceive(msg: Message): void {
    logger.info(msg.content);
  }

  checkTrigger(
    command: string,
    parameters: string[],
    message: string,
    plugin: PluginBase,
    friendly = false,
    keep_default = false,
  ): void {
    logger.info(command, parameters, message, plugin, friendly, keep_default);
  }

  replyMessage(msg: Message, content: string, type = 'text', reply: Message = null, extra: Extra = null): void {
    const message = new Message(null, msg.conversation, this.user, content, type, null, reply, extra);
    this.outbox.emit('message', message);
  }
}
