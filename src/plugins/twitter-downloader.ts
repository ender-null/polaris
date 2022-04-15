import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, sendRequest } from '../utils';

export class TwitterDownloaderPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/twitter-downloader',
        aliases: ['/twdl'],
        parameters: [
          {
            name: 'tweet url',
            required: true,
          },
        ],
        description: 'Download media from tweets',
        skipHelp: false,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    let tweetId;
    const tweetIdPattern = new RegExp('status/(\\d+)', 'gim');
    const twInputMatch = tweetIdPattern.exec(input);
    if (twInputMatch && twInputMatch.length > 0) {
      tweetId = twInputMatch[1];
    } else {
      return this.bot.replyMessage(msg, this.bot.errors.missingParameter);
    }
    const url = `https://canopus.end.works/twdl/getMediaUrls/${tweetId}`;
    const resp = await sendRequest(url, null, null, null, false, this.bot);
    if (!resp) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    const content = await resp.json();
    if (!content.mediaUrls) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    content.mediaUrls.forEach((mediaUrl: string) => {
      const isVideo = mediaUrl.includes('.mp4');
      this.bot.replyMessage(msg, mediaUrl, isVideo ? 'video' : 'photo');
    });
  }
}
