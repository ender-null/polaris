/* eslint-disable @typescript-eslint/no-explicit-any */

import { Bot } from '../bot';
import { PluginBase } from '../plugin';
import { Message } from '../types';
import { sendRequest } from '../utils';

export class CoffeePlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/coffee',
        friendly: '(coffee|cafe|café)',
        description: 'Sends a coffee pic',
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const url = 'https://coffee.alexflipnote.dev/random.json';
    const resp = await sendRequest(url, null, null, null, false, this.bot);
    if (resp) {
      const content = (await resp.json()) as any;
      if (content) {
        const photo = content.file;
        return this.bot.replyMessage(msg, photo, 'photo');
      }
    }
    return this.bot.replyMessage(msg, this.bot.errors.connectionError);
  }
}
