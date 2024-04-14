/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from 'openai';
import crypto from 'crypto';
import tmp from 'tmp';
import fs from 'fs';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, isCommand, logger } from '../utils';

export class ChatGPTPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: `/chatgpt`,
        aliases: ['/ai', '/gpt'],
        parameters: [
          {
            name: 'text',
            required: true,
          },
        ],
        friendly: `^@${this.bot.user.username}`,
        description: 'Use ChatGPT to provide text outputs in response to inputs',
      },
      {
        command: '/voice',
        friendly: '^say ',
        aliases: ['/v', '/tts'],
        parameters: [
          {
            name: 'language',
            required: false,
          },
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
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }

    const openai = new OpenAI({ apiKey: this.bot.config.apiKeys.openAIKey });

    if (isCommand(this, 1, msg.content)) {
      const messages = [{ role: 'system', content: this.bot.config.apiKeys.openAIPrompt }];
      let message = msg;
      while (message.reply) {
        messages.splice(1, 0, { role: 'user', content: message.reply.content });
        message = message.reply;
      }
      messages.push({ role: 'user', content: input });
      logger.info(JSON.stringify(messages, null, 4));

      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        user: crypto.createHash('md5').update(String(msg.sender.id)).digest('hex'),
        messages: messages as any,
      });

      this.bot.replyMessage(msg, completion.choices[0].message.content, 'text', null, { format: 'Markdown' });
    } else if (isCommand(this, 2, msg.content)) {
      const speechFile = tmp.fileSync({ mode: 0o644, postfix: `.ogg` });
      const opus = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input,
      });
      const buffer = Buffer.from(await opus.arrayBuffer());
      await fs.promises.writeFile(speechFile.name, buffer);
      this.bot.replyMessage(msg, speechFile.name, 'voice');
    }
  }
}
