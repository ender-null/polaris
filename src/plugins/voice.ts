import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { download, generateCommandHelp, getInput, mp3ToOgg } from '../utils';

export class VoicePlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/voice',
        shortcut: '/v',
        parameters: [
          {
            name: 'text',
            required: true,
          },
        ],
        description: 'Sends an audio file with the input',
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }

    const language = this.bot.config.locale || 'en_UK';
    const url = 'http://translate.google.com/translate_tts';
    const params = {
      tl: language,
      q: input,
      ie: 'UTF-8',
      total: input.length,
      idx: 0,
      client: 'tw-ob',
      key: this.bot.config.apiKeys.googleDeveloperConsole,
    };
    const headers = {
      Referer: 'https://translate.google.com/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/47.0.2526.8 Safari/537.36',
    };

    if (encodeURI(input).length > 200) {
      return this.bot.replyMessage(msg, this.bot.errors.failed);
    }

    const file = await download(url, params, headers, false, this.bot);
    if (!file) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    const voice = await mp3ToOgg(file);
    if (voice) {
      this.bot.replyMessage(msg, voice, 'voice');
    } else if (file) {
      this.bot.replyMessage(msg, file, 'voice');
    } else {
      this.bot.replyMessage(msg, this.bot.errors.downloadFailed);
    }
  }
}
