import * as cheerio from 'cheerio';
import { URLSearchParams } from 'url';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, sendRequest } from '../utils';

export class ValenciaPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/emt',
        friendly: '^emt ',
        parameters: [
          {
            name: 'station number',
            required: true,
          },
        ],
        description: 'Wait times of EMT Valencia bus',
      },
    ];
    this.strings = {
      station: 'Station',
    };
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    let text = '';
    const url = 'https://www.emtvalencia.es/ciudadano/modules/mod_tiempo/busca_parada.php';
    const headers = {
      Origin: 'https://www.emtvalencia.es',
    };
    const body = new URLSearchParams();
    body.append('parada', input);
    body.append('linea', '');
    body.append('adaptados', '0');
    body.append('usuario', 'Anonimo');
    body.append('idioma', 'es');
    const resp = await sendRequest(url, null, headers, body, true);
    if (!resp) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    const html = await resp.text();
    const $ = cheerio.load(html);
    const schedule = $('.llegadaHome');

    let line = '';
    text = `<b>${this.strings['station']}: ${input}</b>\n\n`;

    schedule.each((i, elem) => {
      line = $('img').eq(i).attr('title');
      const show = $(elem).text().replace('.', '. ').trim();
      const showSplit = show.split(' - ');
      text += ` • <b>${showSplit[1]}</b>  ${line} <i>${showSplit[0]}</i>\n`;
    });

    if (line == '') {
      text = this.bot.errors.noResults;
    }

    this.bot.replyMessage(msg, text);
  }
}
