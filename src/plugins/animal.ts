import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { hasTag, isCommand, responseUrlFromRequest, sendRequest } from '../utils';

export class AnimalPlugin extends PluginBase {
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
      const photo = await responseUrlFromRequest(url, params, null, this.bot);
      if (photo) {
        return this.bot.replyMessage(msg, photo, 'photo');
      } else {
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
    } else if (isCommand(this, 2, msg.content)) {
      const url = 'https://dog.ceo/api/breeds/image/random';
      const resp = await sendRequest(url, null, null, null, false, this.bot);
      if (resp) {
        const content = await resp.json();
        if (content) {
          return this.bot.replyMessage(msg, content.message, 'photo');
        }
      } else {
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
    }
  }
}
