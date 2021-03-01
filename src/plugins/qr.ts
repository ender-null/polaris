import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput } from '../utils';

export class QRPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/qr',
        aliases: ['/qrcode'],
        parameters: [
          {
            name: 'text',
            required: false,
          },
        ],
        description: 'Converts the given string of text to a QR code',
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    const url = `http://chart.apis.google.com/chart?cht=qr&chs=500x500&chl=${input}&chld=H|0.png`;
    this.bot.replyMessage(msg, url, 'photo');
  }
}
