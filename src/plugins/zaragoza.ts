/* eslint-disable @typescript-eslint/no-explicit-any */

import { Bot } from '../bot';
import { PluginBase } from '../plugin';
import { Message } from '../types';
import { capitalize, generateCommandHelp, getInput, isCommand, lstrip, sendRequest } from '../utils';

export class ZaragozaPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/bus',
        friendly: '^bus ',
        parameters: [
          {
            name: 'station',
            required: true,
            type: 'integer',
          },
        ],
        description: 'Wait times of Zaragoza bus station',
        skipHelp: true,
      },
      {
        command: '/tram',
        friendly: '^tram ',
        parameters: [
          {
            name: 'station',
            required: true,
            type: 'integer',
          },
        ],
        description: 'Wait times of Zaragoza tram station',
        skipHelp: true,
      },
      {
        command: '/bizi',
        friendly: '^bizi ',
        parameters: [
          {
            name: 'station',
            required: true,
            type: 'integer',
          },
        ],
        description: 'Zaragoza Bizi station data',
        skipHelp: true,
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
    let text;
    if (isCommand(this, 1, msg.content) || isCommand(this, 2, msg.content)) {
      let url = `https://on.my.end.works/zgz/bus/stations/${input}`;
      if (isCommand(this, 2, msg.content)) {
        url = `https://on.my.end.works/zgz/tram/stations/${input}`;
      }
      const resp = await sendRequest(url, null, null, null, false, this.bot);
      if (!resp) {
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
      const content = (await resp.json()) as any;
      if (!content || content.errors) {
        if (content && content.errors && content.errors.status == 404) {
          return this.bot.replyMessage(msg, this.bot.errors.noResults);
        } else {
          return this.bot.replyMessage(msg, this.bot.errors.connectionError);
        }
      }

      if (content.street) {
        text = `<b>${content.street}</b>\n   ${this.strings.station}: <b>${content.id}</b>  [${content.lines}]\n`;
      } else {
        text = `<b>${this.strings.station}: ${content.id}</b>\n`;
      }

      if (content.times && Array.isArray(content.times)) {
        content.times.map((bus) => {
          text += `\n- <b>${bus.time}</b>  ${bus.line} <i>${bus.destination}</i>`;
        });
      } else {
        return this.bot.replyMessage(msg, this.bot.errors.noResults);
      }
    } else if (isCommand(this, 3, msg.content)) {
      const url = `https://www.zaragoza.es/api/recurso/urbanismo-infraestructuras/estacion-bicicleta/${lstrip(
        input,
        '0',
      )}.json`;
      const params = {
        rf: 'html',
        srsname: 'utm30n',
      };
      const resp = await sendRequest(url, params, null, null, false, this.bot);
      if (!resp) {
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
      const content = (await resp.json()) as any;

      if (!content || content.error) {
        if (content && content.error == 'Parametros incorrectos') {
          return this.bot.replyMessage(msg, this.bot.errors.noResults);
        } else {
          return this.bot.replyMessage(msg, this.bot.errors.connectionError);
        }
      }
      text = `<b>${capitalize(content.title)}</b>\n   ${this.strings.station}: <b>${
        content.id
      }</b>\n\n- Bicis Disponibles: <b>${content.bicisDisponibles}</b>\n- Anclajes Disponibles: <b>${
        content.anclajesDisponibles
      }</b>`;
    }
    this.bot.replyMessage(msg, text);
  }
}
