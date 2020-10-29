import { Bot, Message } from '.';
import { logger } from './utils';

export abstract class PluginBase {
  bot: Bot;
  commands?: Command[];
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

export abstract class Command {
  command: string;
  friendly?: string;
  shortcut?: string;
  parameters?: Parameter[];
  hidden?: boolean;
  description?: string;
  keepDefault?: boolean;

  constructor() {
    this.friendly = null;
    this.shortcut = null;
    this.parameters = null;
    this.hidden = false;
    this.description = null;
    this.keepDefault = false;
  }
}

export abstract class Parameter {
  name: string;
  required: boolean;
}
