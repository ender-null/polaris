import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput } from '../utils';
import { fileSync } from 'tmp';
import fs from 'fs';
import OpenAI from 'openai';

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
    const speechFile = fileSync({ mode: 0o644, postfix: `.ogg` });
    const opus = await client.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input,
    });
    const buffer = Buffer.from(await opus.arrayBuffer());
    await fs.promises.writeFile(speechFile.name, buffer);
    this.bot.replyMessage(msg, speechFile.name, 'voice');
  }
}
