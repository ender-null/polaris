import { EventEmitter } from 'events';
import * as bindings from './bindings/index';
import { BindingsBase, Config, Extra, Message, Plugin, User } from './index';
import { logger } from './main';

export class Bot {
  config: Config;
  bindings: BindingsBase;
  inbox: EventEmitter;
  outbox: EventEmitter;
  started: boolean;
  plugins: Plugin[];
  user: User;

  constructor(config: Config) {
    this.inbox = new EventEmitter();
    this.outbox = new EventEmitter();
    this.config = config;
    this.bindings = new bindings[this.config.bindings](this);
  }

  async start(): Promise<void> {
    await this.bindings.start();
    this.user = await this.bindings.getMe();
    logger.info(this.user.id);
  }

  async stop(): Promise<void> {
    logger.info('stop');
  }

  messagesHandler(): void {
    logger.info('messagesHandler');
  }

  initPlugins(): void {
    logger.info('initPlugins');
  }

  onMessageReceive(msg: Message): void {
    logger.info(msg.content);
  }

  checkTrigger(
    command: string,
    parameters: string[],
    message: string,
    plugin: Plugin,
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
