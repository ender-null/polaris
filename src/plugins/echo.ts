import { Message } from '..';
import { PluginBase } from '../plugin';

export class EchoPlugin extends PluginBase {
  constructor() {
    super();
    this.commands = [];
  }
  async run(msg: Message): Promise<void> {
    await this.bot.replyMessage(msg, msg.content);
  }
}
