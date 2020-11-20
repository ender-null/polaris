import { Bot, Command, iString, Message } from '.';
import { logger } from './utils';

export abstract class PluginBase {
  bot: Bot;
  commands?: Command[];
  bindings?: string[];
  strings?: iString;
  data: any;
  cronExpression?: string;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  afterTranslation(): void {
    logger.debug(`Ignoring because plugin "${this.constructor.name}" missing afterTranslation()`);
  }

  async run(msg: Message): Promise<void> {
    logger.debug(`Ignoring message [${msg.id}] because plugin "${this.constructor.name}" missing run(msg)`);
  }

  async always(msg: Message): Promise<void> {
    logger.debug(`Ignoring message [${msg.id}] because plugin "${this.constructor.name}" missing always(msg)`);
  }

  async cron(): Promise<void> {
    logger.debug(`Ignoring because plugin "${this.constructor.name}" missing cron()`);
  }
}
