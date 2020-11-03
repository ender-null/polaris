import { Bot, Errors, Message } from '..';
import { PluginBase } from '../plugin';
import { hasTag, isCommand, responseUrlFromRequest } from '../utils';

export class AnimalsPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/kitten',
        friendly: '(cat|pussy|kitty|kitten)',
        description: 'Sends a cute kitten',
      },
      {
        command: '/doggo',
        friendly: '(dog|doggo|puppy)',
        description: 'Sends a cute doggo',
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    if (hasTag(this.bot, msg.conversation.id, 'noanimals')) {
      return;
    }
    if (isCommand(this, 1, msg.content)) {
      const url = 'https://api.thecatapi.com/v1/images/search';
      const params = {
        api_key: this.bot.config.apiKeys.catApi,
        format: 'src',
      };
      const photo = await responseUrlFromRequest(url, params);
      if (photo) {
        return this.bot.replyMessage(msg, photo, 'photo');
      } else {
        return this.bot.replyMessage(msg, Errors.connectionError);
      }
    } else if (isCommand(this, 2, msg.content)) {
      const url = 'https://dog.ceo/api/breeds/image/random';
      const photo = await responseUrlFromRequest(url);
      if (photo) {
        return this.bot.replyMessage(msg, photo, 'photo');
      } else {
        return this.bot.replyMessage(msg, Errors.connectionError);
      }
    }
  }
}
