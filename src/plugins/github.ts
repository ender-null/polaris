import { Bot } from '..';
import { PluginBase } from '../plugin';
import { Conversation } from '../types';
import { capitalize, getTaggedWith, logger } from '../utils';

export class GitHubPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
  }

  async webhook(url: string, data: any): Promise<void> {
    logger.debug(`github plugin: ${url}`);

    if (data) {
      let text;
      const subs = getTaggedWith(this.bot, `sub:github/${data.repository.name}`);
      if (data.head_commit) {
        text = `<a href="${data.compare}">${data.commits.length} new commit</a> to <b>${
          data.repository.name
        }:${data.ref.replace('refs/heads/', '')}</b>\n\n<a href="${data.head_commit.url}">${data.head_commit.id.slice(
          0,
          7,
        )}</a>: <i>${data.head_commit.message}</i> by ${data.repository.owner.name}`;
      }
      if (data.check_run) {
        let icon;
        if (data.check_run.status == 'completed') {
          icon = '✔️';
        } else if (data.check_run.status == 'queued') {
          icon = '➕';
        } else if (data.check_run.status == 'failed') {
          icon = '❌';
        } else {
          icon = '❔';
        }
        const status = capitalize(data.check_run.status);
        text = `${icon} ${status} check run <a href="${data.check_run.details_url}">${data.check_run.id}</a>`;
      }
      for (const sub of subs) {
        this.bot.sendMessage(new Conversation(sub), text);
      }
    }
  }
}
