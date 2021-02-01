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
    let text = `<b>${input}</b>`;
    const definitions = $('#resultados article').first();
    const lines = definitions.find('p');
    if (lines.length == 0) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }
    lines.each((index) => {
      const line = lines.eq(index);
      if (line.hasClass('n2')) {
        text += `\n<i>${line.text()}</i>`;
      } else if (line.hasClass('j') || line.hasClass('j2') || line.hasClass('m')) {
        const num = line.find('span').first().text().trim();
        const type = line.find('abbr').first().text().trim();
        const words = line.find('mark');
        let def = '';
        words.each((index) => {
          def += words.eq(index).text() + ' ';
        });
        def = def.trim();
        text += `\n<b>${num}</b> <i>${type}</i> ${def}.`;
      } else if (line.hasClass('k6')) {
        text += `\n<b>${line.text()}</b>`;
      }
    });
    this.bot.replyMessage(msg, text);
  }
}
