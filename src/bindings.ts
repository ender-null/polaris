import { Message } from '.';
import { Bot } from './bot';
import { User } from './user';

export class BindingsBase {
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  async start() {}

  getMe(): User {
    return new User(0);
  }

  onMessageReceive(data: any) {}

  convertMessage(data: any): Message {
    return new Message(0, null, null, data);
  }

  sendMessage() {}
}
