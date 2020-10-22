import { EventEmitter } from 'events';
import * as bindings from './bindings/index';
import { BindingsBase, Config, Message, Plugin, User } from './index';
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

  async start() {
    await this.bindings.start();
    this.user = this.bindings.getMe();
    logger.info(this.user.id);
  }

  stop() {}

  messagesHandler() {}

  initPlugins() {}

  onMessageReceive(msg: Message) {
    logger.info(msg.content);
  }

  checkTrigger(
    command: string,
    parameters: string[],
    message: string,
    plugin: Plugin,
    friendly: boolean = false,
    keep_default: boolean = false,
  ) {
    logger.info(command, parameters, message, plugin, friendly, keep_default);
  }

  replyMessage(msg: Message, content: string, type: string = 'text', reply: Message = null, extra: any = null) {
    const message = new Message(null, msg.conversation, this.user, content, type, null, reply, extra);
    this.outbox.emit('message', message);
  }
}
