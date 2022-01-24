import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import {
  allButNWord,
  delTag,
  generateCommandHelp,
  getInput,
  getTarget,
  getUsername,
  getWord,
  hasTag,
  isCommand,
  isTrusted,
  setTag,
} from '../utils';

export class TagPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/tag',
        parameters: [
          {
            name: 'target',
            required: false,
          },
          {
            name: 'tag',
            required: true,
          },
        ],
        description: 'Sets a tag for an user or group.',
        hidden: true,
      },
      {
        command: '/untag',
        parameters: [
          {
            name: 'target',
            required: false,
          },
          {
            name: 'tag',
            required: true,
          },
        ],
        description: 'Removes a tag of an user or group.',
        hidden: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    let input = getInput(msg);

    if (!isTrusted(this.bot, msg.sender.id, msg)) {
      return this.bot.replyMessage(msg, this.bot.errors.permissionRequired);
    }

    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }

    if (!msg.reply) {
      input = allButNWord(input, 1);
    }

    let target = getTarget(this.bot, msg, getInput(msg, false));
    let name = null;
    if (target) {
      name = getUsername(target);
    } else if (getWord(input, 1) == '-g') {
      target = String(msg.conversation.id);
      name = getUsername(target);
    } else {
      target = String(msg.sender.id);
      name = getUsername(target);
    }

    const tags = input.split(' ');

    if (!target) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }

    // Adds a tag to user or group.
    if (isCommand(this, 1, msg.content)) {
      tags.map((tag) => {
        if (!hasTag(this.bot, target, tag)) {
          setTag(this.bot, target, tag);
        }
      });
      this.bot.replyMessage(msg, `<b>👤 ${name}</b>\n🏷 +<code>${tags.join('</code>\n🏷 +<code>')}</code>`);
    } else if (isCommand(this, 2, msg.content)) {
      tags.map((tag) => {
        if (hasTag(this.bot, target, tag)) {
          delTag(this.bot, target, tag);
        }
      });
      this.bot.replyMessage(msg, `<b>👤 ${name}</b>\n🏷 -<code>${tags.join('</code>\n🏷 -<code>')}</code>`);
    }
  }
}
