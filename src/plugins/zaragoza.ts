import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, isCommand, isInt, sendRequest } from '../utils';

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
        description: 'Wait times of zaragoza bus station',
      },
      {
        command: '/tranvia',
        friendly: '^tranvia ',
        parameters: [
          {
            name: 'station number',
            required: true,
          },
        ],
        description: 'Wait times of zaragoza tram station',
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
    if (isCommand(this, 1, msg.content)) {
      const url = 'https://api.drk.cat/zgzpls/bus/stations';
      const params = {
        number: input,
      };
      const res = await sendRequest(url, params);
      const content = await res.json();
      if (!content || content.errors) {
        if (content && content.errors && content.errors.status == '404 Not Found') {
          return this.bot.replyMessage(msg, this.bot.errors.noResults);
        } else {
          return this.bot.replyMessage(msg, this.bot.errors.connectionError);
        }
      }

      if (content.street) {
        text = `<b>${content.street}</b>\n   ${this.strings['station']}: <b>${content.number}</b>  [${content.lines}]\n\n`;
      } else {
        text = `<b>${this.strings['station']}: ${content.number}</b>\n\n`;
      }

      for (const bus of content.transports) {
        text += ` • <b>${bus.time}</b>  ${bus.line} <i>${bus.destination}</i>\n`;
      }
    } else if (isCommand(this, 2, msg.content)) {
      const url = 'https://api.drk.cat/zgzpls/tram/stations';
      const params = {};
      if (isInt(input)) {
        params['number'] = input;
      } else {
        params['street'] = input;
      }
      const res = await sendRequest(url, params);
      const content = await res.json();
      if (!content || content.errors) {
        if (content && content.errors && content.errors.status == '404 Not Found') {
          return this.bot.replyMessage(msg, this.bot.errors.noResults);
        } else {
          return this.bot.replyMessage(msg, this.bot.errors.connectionError);
        }
      }

      if (content.street) {
        text = `<b>${content.street}</b>\n   ${this.strings['station']}: <b>${content.number}</b>  [${content.lines}]\n\n`;
      } else {
        text = `<b>${this.strings['station']}: ${content.number}</b>\n\n`;
      }

      for (const bus of content.transports) {
        text += ` • <b>${bus.time}</b>  ${bus.line} <i>${bus.destination}</i>\n`;
      }
    } else {
      text = this.bot.errors.notImplemented;
    }
    this.bot.replyMessage(msg, text);
  }
}
