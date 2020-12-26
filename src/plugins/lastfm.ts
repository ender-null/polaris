import format from 'string-format';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, getTags, isCommand, sendRequest, setTag } from '../utils';

export class LastFMPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/nowplaying',
        shortcut: '/np',
        parameters: [
          {
            name: 'username',
            required: false,
          },
        ],
        description: 'Shows the last track played on Last.fm',
      },
      {
        command: '/fmset',
        parameters: [
          {
            name: 'username',
            required: true,
          },
        ],
        description: 'Set Last.fm username',
      },
    ];
    this.strings = {
      isPlaying: '{0} is playing',
      lastPlayed: '{0} last played',
      mightBe: 'This might be it on YouTube',
      usernameSet: 'Your Last.fm username was set, you can change it with {0}fmset.',
    };
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (isCommand(this, 1, msg.content)) {
      let username = input;
      if (!input) {
        const tags = getTags(this.bot, msg.sender.id, 'lastfm:?');
        if (tags && tags.length > 0) {
          username = tags[0].split(':')[1];
        }
        if (!username && msg.sender['username']) {
          username = msg.sender['username'];
        }
        if (!username) {
          return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
        }
      }
      let text = '';
      const url = 'http://ws.audioscrobbler.com/2.0/';
      const params = {
        method: 'user.getrecenttracks',
        format: 'json',
        limit: '1',
        api_key: this.bot.config.apiKeys.lastfm,
        user: username,
      };
      const resp = await sendRequest(url, params, null, null, false, this.bot);
      if (!resp) {
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
      const content = await resp.json();
      if (content.error == 6) {
        return this.bot.replyMessage(msg, this.bot.errors.noResults);
      }

      let last;
      if (
        !content ||
        !content.recenttracks ||
        !Array.isArray(content.recenttracks.track) ||
        content.recenttracks.track.length == 0
      ) {
        return this.bot.replyMessage(msg, this.bot.errors.noResults);
      } else {
        last = content.recenttracks.track[0];
      }

      const artist = last.artist['#text'];
      const track = last.name;
      const album = last.album['#text'];
      const nowplaying = !!(last['@attr'] && last['@attr'].nowplaying);

      if (nowplaying) {
        text = format(this.strings['isPlaying'], username);
      } else {
        text = format(this.strings['lastPlayed'], username);
      }
      text += `:\n\t🎵 <i>${track}</i>\n\t💽 ${artist}`;
      if (album) {
        text += ` - ${album}`;
      }

      // YouTube video
      const ytUrl = 'https://www.googleapis.com/youtube/v3/search';
      const ytParams = {
        type: 'video',
        part: 'snippet',
        maxResults: '8',
        q: `${track} ${artist}`,
        regionCode: this.bot.config.locale.slice(0, 2),
        key: this.bot.config.apiKeys.googleDeveloperConsole,
      };
      const ytResp = await sendRequest(ytUrl, ytParams, null, null, false, this.bot);
      if (!ytResp) {
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
      const ytContent = await ytResp.json();
      if (!ytContent.error && ytContent.pageInfo.totalResults > 0) {
        text += `\n\n🌐 ${this.strings.mightBe}\n${ytContent['items'][0].snippet.title}\nhttps://youtu.be/${ytContent['items'][0].id.videoId}`;
      }
      this.bot.replyMessage(msg, text, 'text', null, { preview: false });
    } else if (isCommand(this, 2, msg.content)) {
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      } else {
        setTag(this.bot, msg.sender.id, `lastfm:${input}`);
        const text = format(this.strings['usernameSet'], this.bot.config.prefix);
        this.bot.replyMessage(msg, text);
      }
    }
  }
}
