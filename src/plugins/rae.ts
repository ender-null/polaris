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
    const url = 'https://dle.rae.es/srv/search';
    const params = {
      w: input,
    };
    const resp = await sendRequest(url, params, null, null, false, this.bot);
    if (!resp) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    const html = await resp.text();
    const $ = cheerio.load(html);
    let text = $('#resultados').text().trim();
    text = text.replace(input, `<b>${input}</b>`);

    if (text.indexOf('Aviso:') > -1) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    this.bot.replyMessage(msg, text);
  }
}
