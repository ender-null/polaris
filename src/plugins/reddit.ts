import { Bot, Message } from '..';
import { PluginBase } from '../plugin';

export class RedditPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        friendly: 'r',
        description: 'Links to subreddit',
        hidden: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    let input = null;
    const inputMatch = /(?:^| )\/?r\/(\S*)/gim.exec(msg.content);
    if (inputMatch && inputMatch.length > 0 && inputMatch[1]) {
      input = inputMatch[1];
    }
    if (input) {
      this.bot.replyMessage(msg, `<a href="https://reddit.com/r/${input}">/r/${input}</a>`);
    }
  }
}
