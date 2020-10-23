import { Bot, User } from '.';

export abstract class BindingsBase {
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  abstract async start(): Promise<void>;

  abstract async stop(): Promise<void>;

  abstract async getMe(): Promise<User>;
}
