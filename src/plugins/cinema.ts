import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { getInput, sendRequest } from '../utils';

export class CinemaPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/cinema',
        parameters: [
          {
            name: 'cinema id',
            required: false,
          },
        ],
        description: 'Returns the films available at cinema',
      },
    ];
    this.strings = {
      cinemas: '<b>Cinemas</b>:',
      movies: '<b>Movies</b>:',
    };
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    let url, text;
    if (!input) {
      url = `https://api.drk.cat/zine/cinema`;
    } else {
      url = `https://api.drk.cat/zine/cinema/${input}`;
    }

    const resp = await sendRequest(url, null, null, null, false, this.bot);
    const content = await resp.json() as any;
    if (!content) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }

    if (!input) {
      text = this.strings.cinemas;
      content.forEach((item) => {
        const address = `https://www.google.es/maps/place/${item.address}/?hl=es`;
        text += `\n<b>${item.name}</b> (<code>${item.id}</code>)\n<a href="${address}">${item.location}</a>\n`;
      });
    } else {
      text = this.strings.movies;
      content.movies.forEach((item) => {
        text += `\n<b>${item.name}</b>\n${item.synopsis}\n<a href="${item.source}">Link</a>\n`;
      });
    }

    return this.bot.replyMessage(msg, text);
  }
}
