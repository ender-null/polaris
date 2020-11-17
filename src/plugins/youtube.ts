import format from 'string-format';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, isCommand, sendRequest } from '../utils';

export class YouTubePlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/youtube',
        shortcut: '/yt',
        parameters: [
          {
            name: 'query',
            required: false,
          },
        ],
        description: 'Returns first YouTube video.',
      },
      {
        command: '/ylist',
        parameters: [
          {
            name: 'query',
            required: false,
          },
        ],
        description: 'Returns a list with 8 YouTube videos.',
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
    let text;
    const url = 'https://www.googleapis.com/youtube/v3/search';
    const params = {
      type: 'video',
      part: 'snippet',
      maxResults: '8',
      q: input,
      key: this.bot.config.apiKeys.googleDeveloperConsole,
    };
    const resp = await sendRequest(url, params);
    const content = await resp.json();
    if (content.error != undefined && content.error.code == '403') {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    if (content.pageInfo.totalResults == 0) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }
    if (isCommand(this, 1, msg.content)) {
      text = `https://youtu.be/${content['items'][0].id.videoId}`;
      this.bot.replyMessage(msg, text, 'text', null, { preview: true });
    } else if (isCommand(this, 2, msg.content)) {
      text = `https://youtu.be/${content['items'][0].id.videoId}`;
      text = format(`<b>${this.strings['results']}</b> <i>{0}</i>:`, input);
      for (const item of content['items']) {
        if (item.snippet.title.length > 26) {
          item.snippet.title = item.snippet.title.split(0, 23) + '...';
        }
        text += `\n • <a href="https://youtu.be/${item.id.videoId}">${item.snippet.title}</a>`;
      }
      this.bot.replyMessage(msg, text, 'text', null, { preview: false });
    }
  }
}
