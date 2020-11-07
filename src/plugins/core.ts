import { Bot, Message } from '..';
import { PluginBase } from '../plugin';

export class CorePlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
  }
  async run(msg: Message): Promise<void> {
    this.bot.replyMessage(msg, null);
  }
}
