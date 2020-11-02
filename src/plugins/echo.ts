import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { capitalize, generateCommandHelp, getInput } from '../utils';

export class EchoPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/echo',
        shortcut: '/e',
        parameters: [
          {
            name: 'text',
            required: false,
          },
        ],
        description: 'Repeat the input',
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
