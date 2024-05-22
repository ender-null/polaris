/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from 'openai';
import crypto from 'crypto';

import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput } from '../utils';
import { Bot } from '../bot';
import { Message } from '../types';

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
        description: 'Use ChatGPT to provide response to an input',
        hidden: true,
      },
    ];
  }

  async run(msg: Message): Promise<void> {
    const input = getInput(msg);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }

    const client = new OpenAI({ apiKey: this.bot.config.apiKeys.openAIKey });
    const messages = [{ role: 'system', content: this.bot.config.apiKeys.openAIPrompt }];
    let message = msg;
    while (message.reply) {
      const role = message.reply.sender.id === this.bot.user.id ? 'assistant' : 'user';
      messages.splice(1, 0, { role, content: message.reply.content });
      message = message.reply;
    }
    messages.push({ role: 'user', content: input });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      user: crypto.createHash('md5').update(String(msg.sender.id)).digest('hex'),
      messages: messages as any,
    });

    this.bot.replyMessage(msg, completion.choices[0].message.content, 'text', null, { format: 'Markdown' });
  }
}
