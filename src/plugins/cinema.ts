/* eslint-disable @typescript-eslint/no-explicit-any */

import { Bot } from '../bot';
import { PluginBase } from '../plugin';
import { Message } from '../types';
import { getInput, sendRequest } from '../utils';

export class CinemaPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/cinema',
        friendly: '^cinema',
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
      url = `https://on.my.end.works/zine/cinema`;
    } else {
      url = `https://on.my.end.works/zine/cinema/${input}`;
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
            if (session.type) label = `${label} ${session.type}`;
            if (this.bot.platform === 'telegram') {
              return `<a href="${session.url}">${label}</a>`;
            } else {
              return label;
            }
          })
          .join(', ');
        text += `\n<b>${item.name}</b>\n`;
        if (this.bot.platform === 'telegram') {
          text += `<a href="${item.source}">🔗</a>`;
          if (item.trailer) {
            text += `<a href="${item.trailer}">🎬</a>`;
          }
        } else {
          text += `<a href="${item.source}">🔗</a>\n`;
        }
        text += `⌛ ${item.durationReadable}`;
        text += `\n🎫 ${sessions}\n`;
      });
    }

    return this.bot.replyMessage(msg, text);
  }
}
