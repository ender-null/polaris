import { Bot, Message } from '.';
import { logger } from './main';

export abstract class PluginBase {
  bot: Bot;
  commands: Command[];

  abstract async run(msg: Message): Promise<void>;

  async always(msg: Message): Promise<void> {
    logger.debug(`Ignoring message [${msg.id}] because plugin "${this.constructor.name}" missing always(msg)`);
  }

  async cron(): Promise<void> {}
}

export abstract class Command {
  command: string;
  parameters: Parameter[];
  hidden: boolean;
  description: string;
  keepDefault: boolean;
}

export abstract class Parameter {
  name: string;
  required: boolean;
}
