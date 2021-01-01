import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { hasTag, isCommand, sendRequest } from '../utils';

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
    let url;
    let params = null;
    if (isCommand(this, 1, msg.content)) {
      url = 'https://api.thecatapi.com/v1/images/search';
      params = {
        api_key: this.bot.config.apiKeys.catApi,
        format: 'src',
      };
    } else if (isCommand(this, 2, msg.content)) {
      url = 'https://dog.ceo/api/breeds/image/random';
    }

    const resp = await sendRequest(url, params, null, null, false, this.bot);
    if (resp) {
      const content = await resp.json();
      if (content) {
        let photo;
        if (isCommand(this, 1, msg.content)) {
          photo = content.url;
        } else {
          photo = content.message;
        }
        return this.bot.replyMessage(msg, photo, 'photo');
      }
    }
    return this.bot.replyMessage(msg, this.bot.errors.connectionError);
  }
}
