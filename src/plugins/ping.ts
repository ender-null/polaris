import { Bot, Message } from '..';
import { PluginBase } from '../plugin';

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
    const text = `Pong`;
    this.bot.replyMessage(msg, text, 'text', null, {
      addPing: true,
    });
  }
}
