/* eslint-disable @typescript-eslint/no-explicit-any */

import { Bot } from '../bot';
import { PluginBase } from '../plugin';
import { Message } from '../types';
import { hasTag, isCommand, sendRequest } from '../utils';

export class AnimalPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/cat',
        friendly: '(cat|pussy|kitty|kitten)',
        description: 'Sends a cute cat pic',
      },
      {
        command: '/dog',
        friendly: '(dog|doge|doggo|puppy)',
        description: 'Sends a cute dog pic',
      },
      {
        command: '/fox',
        friendly: '(fox|vulpini|vulpine|vulpe|kitsune)',
        description: 'Sends a cute fox pic',
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    if (await hasTag(this.bot, msg.conversation.id, 'noanimals')) {
      return;
    }
    let url;
    let params = null;
    if (isCommand(this, 1, msg.content)) {
      url = 'https://api.thecatapi.com/v1/images/search';
      params = {
        api_key: this.bot.config.apiKeys.catApi,
      };
    } else if (isCommand(this, 2, msg.content)) {
      url = 'https://dog.ceo/api/breeds/image/random';
    } else if (isCommand(this, 3, msg.content)) {
      url = 'https://randomfox.ca/floof/';
    }

    const resp = await sendRequest(url, params, null, null, false, this.bot);
    if (resp) {
      const content = (await resp.json()) as any;
      if (content) {
        let photo;
        if (isCommand(this, 1, msg.content)) {
          photo = content[0].url;
        } else if (isCommand(this, 2, msg.content)) {
          photo = content.message;
        } else if (isCommand(this, 3, msg.content)) {
          photo = content.image;
        }
        return this.bot.replyMessage(msg, photo, 'photo');
      }
    }
    return this.bot.replyMessage(msg, this.bot.errors.connectionError);
  }
}
