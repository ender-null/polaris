import format from 'string-format';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { delTag, getInput, hasTag, isAdmin, isTrusted, setTag } from '../utils';

export class ConfigPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/config',
        aliases: ['/cfg'],
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
    this.strings = {
      reactions: 'Reactions',
      roulette: 'Russian roulette',
      replies: 'Replies',
      pole: 'Pole',
      fiesta: 'Fiesta',
      nsfw: 'NSFW',
      antispam: 'Anti SPAM',
      antiarab: 'Anti arab',
      antirussian: 'Anti russian',
      polereset: 'PoleReset',
      explanation: "Toggles group features. The syntax is <i>'{0}config parameter'</i>, the parameters are: '{1}'",
    };
  }
  async run(msg: Message): Promise<void> {
    if (+msg.conversation.id > 0) {
      return this.bot.replyMessage(msg, this.bot.errors.groupOnly);
    }
    const input = getInput(msg);
    const enabled = ['reactions', 'roulette', 'replies', 'pole', 'fiesta', 'nsfw'];
    const disabled = ['antispam', 'antiarab', 'antirussian', 'polereset'];
    const config = {};
    enabled.map((param) => {
      config[param] = !hasTag(this.bot, msg.conversation.id, 'no' + param);
    });

    disabled.map((param) => {
      config[param] = hasTag(this.bot, msg.conversation.id, param);
    });

    let text = '';
    if (!input) {
      text = format(this.strings.explanation, this.bot.config.prefix, Object.keys(config).join("', '"));
      Object.keys(config).map((param) => {
        text += `\n${config[param] ? '✔️' : '❌'} ${this.strings[param]}`;
      });
    } else if (enabled.indexOf(input) > -1 || disabled.indexOf(input) > -1) {
      if ((await !isAdmin(this.bot, msg.sender.id, msg)) && !isTrusted(this.bot, msg.sender.id, msg)) {
        return this.bot.replyMessage(msg, this.bot.errors.permissionRequired);
      }

      if (config[input]) {
        if (enabled.indexOf(input) > -1) {
          setTag(this.bot, msg.conversation.id, 'no' + input);
        } else if (disabled.indexOf(input) > -1) {
          delTag(this.bot, msg.conversation.id, input);
        }
      } else {
        if (enabled.indexOf(input) > -1) {
          delTag(this.bot, msg.conversation.id, 'no' + input);
        } else if (disabled.indexOf(input) > -1) {
          setTag(this.bot, msg.conversation.id, input);
        }
      }

      text += `${config[input] ? '❌' : '✔️'} ${this.strings[input]}`;
    }

    this.bot.replyMessage(msg, text);
  }
}
