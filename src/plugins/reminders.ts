import { Bot, Message } from '..';
import { Errors } from '../errors';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, logger } from '../utils';

export class RemindersPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/remindme',
        parameters: [
          {
            name: 'delay',
            required: true,
          },
          {
            name: 'unit',
            required: true,
          },
          {
            name: 'text',
            required: true,
          },
        ],
        description: 'Remind you things after a delay.',
      },
    ];
    this.cronExpression = '*/10 * * * * *';
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content), 'text', null, { format: 'HTML' });
    }
    this.bot.replyMessage(msg, Errors.notImplemented);
  }

  async cron() {
    logger.debug('TODO');
  }
}
