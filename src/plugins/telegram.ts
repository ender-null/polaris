import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, getTarget, isAdmin, isCommand, isGroupAdmin, isMod, logger } from '../utils';

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
      {
        command: '/desc',
        parameters: [
          {
            name: 'text',
            required: true,
          },
        ],
        description: 'Sets group description',
        hidden: true,
      },
      {
        command: '/gphoto',
        description: 'Sets group photo',
        hidden: true,
      },
      {
        command: '/promote',
        parameters: [
          {
            name: 'user id | @username',
            required: true,
          },
        ],
        description: 'Promote a user to admin',
        hidden: true,
      },
      {
        command: '/kick',
        parameters: [
          {
            name: 'user id | @username',
            required: true,
          },
        ],
        description: 'Kicks a user from group',
        hidden: true,
      },
      {
        command: '/ban',
        parameters: [
          {
            name: 'user id | @username',
            required: true,
          },
        ],
        description: 'Kicks a user from group',
        hidden: true,
      },
      {
        command: '/unban',
        parameters: [
          {
            name: 'user id | @username',
            required: true,
          },
        ],
        description: 'Unban a user from group',
        hidden: true,
      },
      {
        command: '/delete',
        description: 'Deletes a message',
        hidden: true,
      },
      {
        command: '/setpin',
        description: 'Pins a message',
        hidden: true,
      },
      {
        command: '/rmpin',
        description: 'Removes the pinned message',
        hidden: true,
      },
      {
        command: '/suicide',
        description: 'Kicks the bot from the group',
        hidden: true,
      },
      {
        command: '/createInviteLink',
        parameters: [
          {
            name: 'name',
            required: false,
          },
        ],
        description: 'Create invite link for the group',
        hidden: true,
      },
      {
        command: '/call',
        description: 'Create call',
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
      text = this.strings.commands;
      for (const command of this.commands) {
        const doc = generateCommandHelp(this, command.command, true);
        if (doc) {
          const lines = doc.split('\n');

          text += `\n • ${lines[0]}`;

          if (lines.length > 1) {
            text += `\n   ${lines[1]}`;
          } else {
            text += `\n   <i>${this.strings.noDescription}</i>`;
          }
        }
      }
      return this.bot.replyMessage(msg, text);
    } else if (isCommand(this, 2, msg.content)) {
      if (!input && !msg.reply) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      if (this.checkPermissions(msg)) {
        ok = await this.bot.bindings.renameConversation(msg.conversation.id, input);
      }
    } else if (isCommand(this, 3, msg.content)) {
      if (!input && !msg.reply) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      if (this.checkPermissions(msg)) {
        ok = await this.bot.bindings.changeConversationDescription(msg.conversation.id, input);
      }
    } else if (isCommand(this, 4, msg.content)) {
      if (!msg.reply) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      if (this.checkPermissions(msg)) {
        if (msg.reply && msg.reply.type == 'photo') {
          const photo = await this.bot.bindings.getFile(msg.reply.content);
          if (photo) {
            ok = await this.bot.bindings.changeConversationPhoto(msg.conversation.id, photo);
          } else {
            ok = await this.bot.bindings.changeConversationPhoto(msg.conversation.id, msg.reply.content);
          }
        }
      }
    } else if (isCommand(this, 5, msg.content)) {
      if (!input && !msg.reply) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      if (this.checkPermissions(msg)) {
        const target = getTarget(this.bot, msg, input);
        ok = await this.bot.bindings.promoteConversationMember(msg.conversation.id, target);
      }
    } else if (isCommand(this, 6, msg.content)) {
      if (!input && !msg.reply) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      if (this.checkPermissions(msg)) {
        const target = getTarget(this.bot, msg, input);
        if (!isAdmin(this.bot, target)) {
          ok = await this.bot.bindings.kickConversationMember(msg.conversation.id, target);
        }
      }
    } else if (isCommand(this, 7, msg.content)) {
      if (!input && !msg.reply) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      if (this.checkPermissions(msg)) {
        if (!input && !msg.reply) {
          return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
        }
        const target = getTarget(this.bot, msg, input);
        if (!isAdmin(this.bot, target)) {
          ok = await this.bot.bindings.banConversationMember(msg.conversation.id, target);
        }
      }
    } else if (isCommand(this, 8, msg.content)) {
      if (!input && !msg.reply) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      if (this.checkPermissions(msg)) {
        const target = getTarget(this.bot, msg, input);
        ok = await this.bot.bindings.unbanConversationMember(msg.conversation.id, target);
      }
    } else if (isCommand(this, 9, msg.content)) {
      if (!msg.reply) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      if (this.checkPermissions(msg)) {
        await this.bot.bindings.deleteMessage(msg.conversation.id, msg.id);
        if (msg.reply) {
          ok = await this.bot.bindings.deleteMessage(msg.conversation.id, msg.reply.id);
        }
      }
    } else if (isCommand(this, 10, msg.content)) {
      if (!msg.reply) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      if (this.checkPermissions(msg)) {
        if (msg.reply) {
          ok = true;
          this.bot.replyMessage(msg, 'pinChatMessage', 'native', null, {
            messageId: msg.reply.id,
          });
        }
      }
    } else if (isCommand(this, 11, msg.content)) {
      if (!msg.reply) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      if (this.checkPermissions(msg)) {
        if (msg.reply) {
          ok = true;
          this.bot.replyMessage(msg, 'unpinChatMessage', 'native', null, {
            messageId: msg.reply.id,
          });
        }
      }
    } else if (isCommand(this, 12, msg.content)) {
      if (this.checkPermissions(msg)) {
        ok = await this.bot.bindings.leaveConversation(msg.conversation.id);
      }
    } else if (isCommand(this, 13, msg.content)) {
      if (this.checkPermissions(msg)) {
        ok = await this.bot.bindings.createInviteLink(msg.conversation.id, input);
      }
    } else if (isCommand(this, 14, msg.content)) {
      if (this.checkPermissions(msg)) {
        ok = await this.bot.bindings.createCall(msg.conversation.id, false);
      }
    } else {
      logger.info('no command match');
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
