import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { now } from '../utils';

export class PingPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/ping',
        description: 'Checks response time',
        skipHelp: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const time = now() - msg.extra.received;
    const text = `Pong\n<code>${time}</code>`;
    this.bot.replyMessage(msg, text);
  }
}
