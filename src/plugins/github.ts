import { Bot } from '..';
import { PluginBase } from '../plugin';
import { logger } from '../utils';

export class GitHubPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
  }

  async webhook(data): Promise<void> {
    logger.info('github plugin');
    if (data['head_commit']) {
      this.bot.sendAdminAlert(`new commit: ${data['head_commit']['message']}`);
    } else {
      logger.info(`other`);
    }
  }
}
