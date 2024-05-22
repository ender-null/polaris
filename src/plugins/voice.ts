import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, mp3ToOgg } from '../utils';
import { fileSync } from 'tmp';
import fs from 'fs';
import OpenAI from 'openai';
import { Bot } from '../bot';
import { Message } from '../types';

export class VoicePlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/voice',
        friendly: '^say ',
        aliases: ['/v', '/tts'],
        parameters: [
          {
            name: 'text',
            required: true,
            type: 'string',
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

    const client = new OpenAI({ apiKey: this.bot.config.apiKeys.openAIKey });
    const speechFile = fileSync({ mode: 0o644, postfix: `.mp3` });
    const mp3 = await client.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(speechFile.name, buffer);
    this.bot.replyMessage(msg, speechFile.name, 'voice');

    const voice = await mp3ToOgg(speechFile.name);
    if (voice) {
      this.bot.replyMessage(msg, voice, 'voice');
    } else if (speechFile) {
      this.bot.replyMessage(msg, speechFile.name, 'voice');
    } else {
      this.bot.replyMessage(msg, this.bot.errors.downloadFailed);
    }
  }
}
