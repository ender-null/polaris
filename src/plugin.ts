import { Bot, Command, iString, Message } from '.';
import { logger } from './utils';

export abstract class PluginBase {
  bot: Bot;
  commands?: Command[];
  bindings?: string[];
  strings?: iString;
  cronExpression?: string;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  abstract async run(msg: Message): Promise<void>;

  async always(msg: Message): Promise<void> {
    logger.debug(`Ignoring message [${msg.id}] because plugin "${this.constructor.name}" missing always(msg)`);
  }

  async cron(): Promise<void> {
    logger.debug(`Ignoring because plugin "${this.constructor.name}" missing cron()`);
  }
}
