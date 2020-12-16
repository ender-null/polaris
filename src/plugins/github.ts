import { Bot } from '..';
import { PluginBase } from '../plugin';
import { logger } from '../utils';

export class GitHubPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
  }

  async webhook(url: string, data: string): Promise<void> {
    logger.info(`github plugin: ${url}`);
    if (data['head_commit']) {
      this.bot.sendAdminAlert(`new commit: ${data['head_commit']['message']}`);
    } else {
      logger.info(`other`);
    }
  }
}
