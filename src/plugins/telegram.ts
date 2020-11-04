import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, isAdmin, isCommand, isGroupAdmin, isMod } from '../utils';

export class TelegramPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/adminhelp',
        description: 'Admin commands',
      },
      {
        command: '/title',
        parameters: [
          {
            name: 'text',
            required: true,
          },
        ],
        description: 'Sets group title',
        hidden: true,
      },
    ];
    this.strings = {
      commands: '<b>Commands</b>:',
      noDescription: 'No description',
    };
    this.bindings = ['TelegramTDlibBindings'];
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg);
    let ok = false;
    let text;

    if (msg.conversation.id > 0) {
      return this.bot.replyMessage(msg, this.bot.errors.groupOnly);
    }

    // List all administration commands.
    if (isCommand(this, 1, msg.content)) {
      text = this.strings['commands'];
      for (const command of this.commands) {
        const doc = generateCommandHelp(this, command.command, false);
        if (doc) {
          const lines = doc.split('\n');

          text += `\n • ${lines[0]}`;

          if (lines.length > 1) {
            text += `\n   ${lines[1]}`;
          } else {
            text += `\n   <i>${this.strings['noDescription']}</i>`;
          }
        }
      }
      return this.bot.replyMessage(msg, text);
    } else if (isCommand(this, 2, msg.content)) {
      if (this.checkPermissions(msg)) {
        ok = await this.bot.bindings.renameConversation(msg.conversation.id, input);
      }
    }

    if (!ok) {
      return this.bot.replyMessage(msg, this.bot.errors.failed);
    }
  }

  checkPermissions(msg: Message): boolean {
    if (!isGroupAdmin(this.bot, this.bot.user.id, msg)) {
      this.bot.replyMessage(msg, this.bot.errors.adminRequired);
      return false;
    }

    if (!isAdmin(this.bot, msg.sender.id) && !isMod(this.bot, msg.sender.id, msg.conversation.id)) {
      this.bot.replyMessage(msg, this.bot.errors.permissionRequired);
      return false;
    }

    return true;
  }
}
