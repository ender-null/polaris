import { Bot, Message } from '..';
import { PluginBase } from '../plugin';

export class EchoPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/echo',
        parameters: [
          {
            name: 'text',
            required: true,
          },
        ],
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    await this.bot.replyMessage(msg, msg.content);
  }
}
