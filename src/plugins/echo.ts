import { Bot } from '../bot';
import { PluginBase } from '../plugin';
import { Message } from '../types';
import { capitalize, generateCommandHelp, getInput } from '../utils';

export class EchoPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/echo',
        aliases: ['/e'],
        parameters: [
          {
            name: 'text',
            required: false,
            type: 'string',
          },
        ],
        description: 'Repeat the input',
        skipHelp: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    this.bot.replyMessage(msg, capitalize(input));
  }
}
