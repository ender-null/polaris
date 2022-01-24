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
    const content = (await resp.json()) as any;
    if (!content) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }

    if (!input) {
      text = '';
      content.forEach((item) => {
        text += `\n<b>${item.name}</b> (<code>${item.id}</code>)\n${item.address}\n`;
      });
    } else {
      text = '';
      content.movies.forEach((item) => {
        const sessions = item.sessions
          .map((session) => {
            let label = session.time;
            if (session.type) label = `${label} [${session.type}]`;
            return `<a href="${session.url}">${label}</a>`;
          })
          .join(', ');
        text += `\n<b>${item.name}</b>\n<a href="${item.source}">🔗</a> <a href="${item.trailer}">🎬</a> ⌛ ${item.durationReadable}\n🎫 ${sessions}\n`;
      });
    }

    return this.bot.replyMessage(msg, text);
  }
}
