import { Bot } from '../bot';
import { PluginBase } from '../plugin';
import { Message } from '../types';

export class PingPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/ping',
        friendly: '^ping$',
        description: 'Checks response time',
        skipHelp: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const text = 'Pong!';
    this.bot.replyMessage(msg, text, 'text', null, {
      addPing: true,
    });
  }
}
