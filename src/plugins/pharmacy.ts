import * as cheerio from 'cheerio';

import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, sendRequest } from '../utils';
import { Bot } from '../bot';
import { Message } from '../types';

export class PharmacyPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/pharmacy',
        parameters: [
          {
            name: 'city',
            required: true,
            type: 'string',
          },
        ],
        description: 'Open pharmacies in Spain by city',
        skipHelp: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    const params = {
      ciudad: input,
      go: 1,
      farmacias: 'de-guardia',
      hampliado: 1,
      '24horas': 1,
    };
    const resp = await sendRequest('https://www.farmaciasabiertas.org/q.php', params, null, null, false, this.bot);
    if (!resp) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    let text = '';
    const html = await resp.text();
    const $ = cheerio.load(html);
    const names = $('.results td.nome');
    const addresses = $('.results td.indirizzo');
    const schedules = $('.results td.orari');
    names.each((index) => {
      const name = names.eq(index).text();
      const address = addresses.eq(index).text().replace(' Abrir el mapa »', '').replace('Teléfono', '</i>\nTeléfono:');
      const schedule = schedules.eq(index).text();
      text += `<b>${name}</b>\n<i>${address}\n${schedule}\n\n`;
    });

    this.bot.replyMessage(msg, text);
  }
}
