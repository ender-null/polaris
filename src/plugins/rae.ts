import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, sendRequest } from '../utils';

export class RAEPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/rae',
        parameters: [
          {
            name: 'term',
            required: true,
          },
        ],
        description: 'Look for definitions in the Real Academia de la Lengua',
        skipHelp: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    const url = `https://api.drk.cat/rae/search/${input}`;
    const resp = await sendRequest(url, null, null, null, false, this.bot);
    if (!resp) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }

    const content = (await resp.json()) as any;

    let text = `<b>${content.term}</b>\n<i>${content.etymology}</i>\n`;
    content.meanings.forEach((meaning) => {
      text += `\n${meaning.number} ${meaning.type}${meaning.country.length ? '' : ` ${meaning.country}`}: ${
        meaning.definition
      }\n`;
    });
    content.complexForms.forEach((expression) => {
      text += `\n<b>${expression.expression}</b>`;
      expression.meanings.forEach((meaning) => {
        text += `\n${meaning.number} ${meaning.type}${meaning.country.length ? '' : ` ${meaning.country}`}: ${
          meaning.definition
        }\n`;
      });
    });

    content.expressions.forEach((expression) => {
      text += `\n<b>${expression.expression}</b>`;
      expression.meanings.forEach((meaning) => {
        text += `\n${meaning.number} ${meaning.type}${meaning.country.length ? '' : ` ${meaning.country}`}: ${
          meaning.definition
        }\n`;
      });
    });

    this.bot.replyMessage(msg, text);
  }
}
