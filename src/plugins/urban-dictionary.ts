import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, sendRequest } from '../utils';

export class UrbanDictionaryPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/urbandictionary',
        aliases: ['/ud', '/urban'],
        parameters: [
          {
            name: 'term',
            required: true,
          },
        ],
        description: 'Look for definitions in the Urban Dictionary',
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    const term = input.toLowerCase();
    const url = 'https://api.urbandictionary.com/v0/define';
    const params = {
      term: term,
    };
    const resp = await sendRequest(url, params, null, null, false, this.bot);
    if (!resp) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    const content = await resp.json() as any;

    if (!content.list || content.list.length == 0) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    const entry = content.list[0];
    let text = `<b>${term}</b>\n\n${entry.definition}`;
    if (entry.example) {
      text += `\n\n<i>${entry.example}</i>`;
    }
    this.bot.replyMessage(msg, text);
  }
}
