import OpenAI from 'openai';
import crypto from 'crypto';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput } from '../utils';

export class EchoPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: `@${this.bot.user.username}`,
        parameters: [
          {
            name: 'text',
            required: false,
          },
        ],
        description: 'Use ChatGPT to provide text outputs in response to inputs',
        skipHelp: true,
      },
    ];
  }

  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }

    const messages = [
      { role: 'system', content: this.bot.config.apiKeys.openAIPrompt },
      { role: 'user', content: input },
    ];

    const openai = new OpenAI({ apiKey: this.bot.config.apiKeys.openAIKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      user: crypto.createHash('md5').update(String(msg.sender.id)).digest('hex'),
      messages: messages as any,
    });

    this.bot.replyMessage(msg, completion.choices[0].message.content, 'text', null, { format: 'Markdown' });
  }
}
