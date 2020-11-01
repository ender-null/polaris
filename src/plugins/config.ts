import format from 'string-format';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { delTag, firstWord, getInput, hasTag, isAdmin, isTrusted, setTag } from '../utils';

export class ConfigPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/config',
        parameters: [
          {
            name: 'parameter',
            required: false,
          },
        ],
        keepDefault: true,
        description: 'Configure parameters',
      },
    ];
    this.strings = { explanation: '' };
  }
  async run(msg: Message): Promise<void> {
    if (+msg.conversation.id > 0) {
      return this.bot.replyMessage(msg, this.bot.errors.groupOnly);
    }
    const input = getInput(msg, false);
    const parameter = firstWord(input);
    const enabled = ['reactions', 'roulette', 'replies', 'pole', 'fiesta', 'nsfw'];
    const disabled = ['antispam', 'antiarab', 'antirussian', 'polereset'];
    const config = {};
    for (const param of enabled) {
      config[param] = !hasTag(this.bot, msg.conversation.id, 'no' + param);
    }

    for (const param of disabled) {
      config[param] = hasTag(this.bot, msg.conversation.id, param);
    }

    let text = '';
    if (!input) {
      text = format(this.strings.explanation, Object.keys(config).join("', '"));
      for (const param of Object.keys(config)) {
        text += `\n${config[param] ? '✔️' : '❌'} ${this.strings[param]}`;
      }
    } else if (parameter in enabled || parameter in disabled) {
      if (!isAdmin(this.bot, msg.sender.id, msg) && !isTrusted(this.bot, msg.sender.id, msg)) {
        return this.bot.replyMessage(msg, this.bot.errors.permissionRequired);
      }

      if (config[parameter]) {
        if (parameter in enabled) {
          setTag(this.bot, msg.conversation.id, 'no' + parameter);
        } else if (parameter in disabled) {
          delTag(this.bot, msg.conversation.id, parameter);
        }
      } else {
        if (parameter in enabled) {
          delTag(this.bot, msg.conversation.id, 'no' + parameter);
        } else if (parameter in disabled) {
          setTag(this.bot, msg.conversation.id, parameter);
        }
      }

      text += `${config[parameter] ? '❌' : '✔️'} ${this.strings[parameter]}`;
    }

    this.bot.replyMessage(msg, text);
  }
}
