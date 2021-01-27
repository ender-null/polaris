import * as cheerio from 'cheerio';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, sendRequest } from '../utils';

export class RAEPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/rae',
        parameters: [
          {
            name: 'term',
            required: true,
          },
        ],
        description: 'Look for definitions in the Real Academia de la Lengua',
        skipHelp: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    const resp = await sendRequest('https://dle.rae.es/srv/search?w=' + input, null, null, null, false, this.bot);
    if (!resp) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    const html = await resp.text();
    const $ = cheerio.load(html);

    const text = await $('#resultados').text().trim();

    const buf = Buffer.from(text);

    if (buf.indexOf('Aviso') == 0) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }
    this.bot.replyMessage(msg, text);
  }
}
