import { Bot } from '../bot';
import { PluginBase } from '../plugin';
import { Message } from '../types';
import { sendRequest } from '../utils';

export class CommitPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/commit',
        description: 'Returns a commit message from whatthecommit.com',
        skipHelp: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const url = 'https://whatthecommit.com/index.txt';
    const resp = await sendRequest(url, null, null, null, false, this.bot);
    const commit = await resp.text();
    if (!commit) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    const content = `<blockquote>${commit}</blockquote>`;
    return this.bot.replyMessage(msg, content);
  }
}
