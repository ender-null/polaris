import { Bot } from '..';
import { PluginBase } from '../plugin';
import { Conversation } from '../types';
import { getTaggedWith, logger } from '../utils';

export class GitHubPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
  }

  async webhook(url: string, data: any): Promise<void> {
    logger.debug(`github plugin: ${url}`);

    if (data && data.head_commit) {
      const text = `<a href="${data.compare}">${data.commits.length} new commit</a> to <b>${
        data.repository.name
      }:${data.ref.replace('refs/heads/', '')}</b>\n\n<a href="${data.head_commit.url}">${data.head_commit.id.slice(
        0,
        7,
      )}</a>: <i>${data.head_commit.message}</i> by ${data.repository.owner.name}`;
      const subs = getTaggedWith(this.bot, `sub:github/${data.repository.name}`);
      for (const sub of subs) {
        this.bot.sendMessage(new Conversation(sub), text);
      }
    }
  }
}
