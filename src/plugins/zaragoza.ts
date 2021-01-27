import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { capitalize, generateCommandHelp, getInput, isCommand, isInt, lstrip, sendRequest } from '../utils';

export class ZaragozaPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/bus',
        friendly: '^bus ',
        parameters: [
          {
            name: 'station number',
            required: true,
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
            name: 'station number',
            required: true,
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
            name: 'station number',
            required: true,
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
      let url = 'https://api.drk.cat/zgzpls/bus/stations';
      if (isCommand(this, 2, msg.content)) {
        url = 'https://api.drk.cat/zgzpls/tram/stations';
      }
      const params = {
        source: 'official-api',
      };
      if (isInt(input)) {
        params['number'] = input;
      } else {
        params['street'] = input;
      }
      const resp = await sendRequest(url, params, null, null, false, this.bot);
      if (!resp) {
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
      const content = await resp.json();
      if (!content || content.errors) {
        if (content && content.errors && content.errors.status == '404 Not Found') {
          return this.bot.replyMessage(msg, this.bot.errors.noResults);
        } else {
          return this.bot.replyMessage(msg, this.bot.errors.connectionError);
        }
      }

      if (content.street) {
        text = `<b>${content.street}</b>\n   ${this.strings.station}: <b>${content.number}</b>  [${content.lines}]\n\n`;
      } else {
        text = `<b>${this.strings.station}: ${content.number}</b>\n\n`;
      }

      if (content.transports && Array.isArray(content.transports)) {
        for (const bus of content.transports) {
          text += ` • <b>${bus.time}</b>  ${bus.line} <i>${bus.destination}</i>\n`;
        }
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
      const content = await resp.json();

      if (!content || content.error) {
        if (content && content.error == 'Parametros incorrectos') {
          return this.bot.replyMessage(msg, this.bot.errors.noResults);
        } else {
          return this.bot.replyMessage(msg, this.bot.errors.connectionError);
        }
      }
      text = `<b>${capitalize(content.title)}</b>\n   ${this.strings.station}: <b>${
        content.id
      }</b>\n\n • Bicis Disponibles: <b>${content.bicisDisponibles}</b>\n • Anclajes Disponibles: <b>${
        content.anclajesDisponibles
      }</b>`;
    }
    this.bot.replyMessage(msg, text);
  }
}
