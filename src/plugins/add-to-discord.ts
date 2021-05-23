import format from 'string-format';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';

export class AddToDiscordPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/discord',
        description: 'Get link to invite me to your Discord server',
      },
    ];
    this.strings = {
      info: 'There is a <b>beta</b> of me in Discord, if you wanna try.\n\n<a href="{0}">Add me to Discord</a>',
    };
  }
  async run(msg: Message): Promise<void> {
    const permissions = 4294967287;
    const url = format(
      'https://discord.com/api/oauth2/authorize?client_id={0}&permissions={1}&scope=bot',
      this.bot.config.apiKeys.discordClientId,
      permissions,
    );
    const text = format(this.strings.info, url);
    this.bot.replyMessage(msg, text);
  }
}
