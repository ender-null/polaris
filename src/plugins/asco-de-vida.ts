import * as cheerio from 'cheerio';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { sendRequest } from '../utils';

export class AscoDeVidaPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/adv',
        description: 'Random story from Asco de Vida',
        skipHelp: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const resp = await sendRequest('http://www.ascodevida.com/aleatorio', null, null, null, false, this.bot);
    if (!resp) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    const html = await resp.text();
    const $ = cheerio.load(html);
    const story = $('.story').first();
    const published = story.find('.pre').text();
    let content = story.find('.advlink').text();
    content = content.replace('<br/>', '\n');
    content = content.replace('ADV', '<b>ADV</b>');
    const text = `${content}\n\n<i>${published.trim()}</i>`;
    this.bot.replyMessage(msg, text);
  }
}
