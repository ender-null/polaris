/* eslint-disable @typescript-eslint/no-explicit-any */
import format from 'string-format';

import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, hasTag, isCommand, removeHtml, sendRequest } from '../utils';
import { Bot } from '../bot';
import { Message } from '../types';

export class SearchPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/search',
        aliases: ['/s', '/ddg'],
        friendly: '^Search ',
        parameters: [
          {
            name: 'query',
            required: false,
          },
        ],
        description: 'Returns first web result',
      },
      {
        command: '/results',
        parameters: [
          {
            name: 'query',
            required: false,
          },
        ],
        description: 'Returns a list with 8 web results',
      },
    ];
    this.strings = {
      results: 'Results of',
    };
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    const searchUrl = 'https://duckduckgo.com/';
    const searchParams = {
      q: input,
    };
    const searchResp = await sendRequest(searchUrl, searchParams, null, null, false, this.bot);
    if (!searchResp) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    const searchContent = await searchResp.text();
    const searchObj = new RegExp('vqd=([\\d-]+)&', 'gim').exec(searchContent);
    if (!searchObj || searchObj.length == 0) {
      return this.bot.replyMessage(msg, this.bot.errors.failed);
    }

    const headers = {
      authority: 'duckduckgo.com',
      accept: 'application/json, text/javascript, */*; q=0.01',
      'sec-fetch-dest': 'empty',
      'x-requested-with': 'XMLHttpRequest',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      referer: 'https://duckduckgo.com/',
      'accept-language': (this.bot.config.locale || 'en_US') + ';q=0.9',
    };
    const params = {
      l: this.bot.config.locale || 'en_US',
      dl: (this.bot.config.locale || 'en_US').slice(0, 2),
      ct: (this.bot.config.locale || 'en_US').slice(0, 2).toUpperCase(),
      ss_mkt: (this.bot.config.locale || 'en_US').slice(0, 2),
      o: 'json',
      q: input,
      vqd: searchObj[1],
      f: ',,,',
      p: '1',
      v7exp: 'a',
    };
    if (!(await hasTag(this.bot, msg.conversation.id, 'nonsfw'))) {
      params['kp'] = -2;
    }

    const url = searchUrl + 'd.js';
    const resp = await sendRequest(url, params, headers, null, false, this.bot);
    if (!resp) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    let content;
    try {
      content = (await resp.json()) as any;
    } catch (error) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }

    if (!content || content['results'] == undefined) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    if (content.results.length == 0) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }
    if (isCommand(this, 1, msg.content)) {
      return this.bot.replyMessage(msg, content.results[0].u, 'text', null, { format: 'HTML', preview: true });
    } else {
      let text = format(`<b>${this.strings['results']}</b> <i>{0}</i>:`, input);
      let limit = 8;
      content.results.map((item) => {
        if (item['t'] && limit >= 0) {
          item['t'] = removeHtml(item['t']);
          if (item['t'].length > 26) {
            item['t'] = item['t'].slice(0, 23) + '...';
          }
          text += `\n • <a href="${item['u']}">${item['t']}</a>`;
          limit -= 1;
        }
      });
      return this.bot.replyMessage(msg, text, 'text', null, { format: 'HTML', preview: false });
    }
  }
}
