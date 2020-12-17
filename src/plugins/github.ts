import { Bot } from '..';
import { PluginBase } from '../plugin';
import { Conversation } from '../types';
import { getTaggedWith, logger } from '../utils';

export class GitHubPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
  }

  async webhook(url: string, data: string): Promise<void> {
    logger.debug(`github plugin: ${url}`);
    const cb = JSON.parse(data);
    const text = `🔨 <a href="${cb.compare}">${cb.commits.length} new commit</a> <b>to ${
      cb.repository.name
    }:${cb.ref.replace('refs/heads/', '')}</b>:\n\n<a href="${cb.head_commit.url}">${cb.head_commit.id.slice(
      0,
      7,
    )}</a>: ${cb.head_commit.message} by ${cb.head_commit.committer.name}`;

    if (cb.head_commit) {
      const subs = getTaggedWith(this.bot, `sub:github/${cb.repository.name}`);
      for (const sub of subs) {
        this.bot.sendMessage(new Conversation(sub), text);
      }
    }
  }
}
