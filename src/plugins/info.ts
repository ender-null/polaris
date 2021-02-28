import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { DatabaseConversation, DatabaseUser } from '../types';
import { formatDate, formatNumber, getInput, getTags, getTarget, isInt, logger, telegramShortLink } from '../utils';

export class InfoPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/info',
        aliases: ['/who', '/id'],
        parameters: [
          {
            name: 'target',
            required: false,
          },
        ],
        description: 'Info about the user and group',
        skipHelp: true,
      },
    ];
    this.strings = {
      bot: 'Bot',
      reported: 'Reported',
      channel: 'Channel',
      members: 'Members',
      restrictionReason: 'Restriction reason',
    };
  }
  async run(msg: Message): Promise<void> {
    const gid = String(msg.conversation.id);
    const input = getInput(msg, false);
    let target = getTarget(this.bot, msg, input);

    let text = '';
    const user: DatabaseUser = {};
    const group: DatabaseConversation = {};
    let showGroup = false;
    let chat, info, infoFull, userId, groupId, userTags, groupTags;

    if (this.bot.config.bindings == 'TelegramTDlibBindings') {
      chat = await this.bot.bindings['serverRequest']('getChat', { chat_id: target }, true);
      if (target && isInt(target) && !String(target).startsWith('-')) {
        info = await this.bot.bindings['serverRequest']('getUser', { user_id: target }, true);
        infoFull = await this.bot.bindings['serverRequest']('getUserFullInfo', { user_id: target }, true);
      } else if (target && isInt(target) && target.startsWith('-100')) {
        info = await this.bot.bindings['serverRequest']('getSupergroup', { supergroup_id: target.slice(4) }, true);
        infoFull = await this.bot.bindings['serverRequest'](
          'getSupergroupFullInfo',
          { supergroup_id: target.slice(4) },
          true,
        );
      }
    }

    // logger.info(`target: ${target}`);
    // logger.info(`chat: ${JSON.stringify(chat)}`);
    // logger.info(`info: ${JSON.stringify(info)}`);
    // logger.info(`infoFull: ${JSON.stringify(infoFull)}`);
    if (!target || (target && !(db.users[target] || db.groups[target] || !isInt(target) || info || chat))) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    if (target) {
      if (!String(target).startsWith('-')) {
        userId = target;
        if (db.users[target]) {
          const props = ['first_name', 'last_name', 'username', 'nick', 'description', 'is_bot', 'is_scam'];
          for (const prop of props) {
            if (db.users[target][prop]) {
              user[prop] = db.users[target][prop];
            }
          }
        }

        if (info) {
          userId = info.id;
          if (info.first_name && info.first_name.length > 0) {
            user.first_name = info.first_name;
          }
          if (info.last_name && info.last_name.length > 0) {
            user.last_name = info.last_name;
          }
          if (info.username && info.username.length > 0) {
            user.username = info.username;
          }
          if (info.is_scam) {
            user.is_scam = info.is_scam;
          }
          user.is_bot = info.type._ == 'userTypeBot';
        }
        if (infoFull) {
          user.description = info.bio || '';
        }
        logger.info(`user: ${JSON.stringify(user)}`);
        db.users[target] = user;
        db.usersSnap.child(target).ref.set(user);
        const tags = getTags(this.bot, userId);
        if (tags && tags.length > 0) {
          userTags = tags.join(', ');
        }
      } else {
        showGroup = true;
        groupId = target;
      }
    } else {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    if (String(target).startsWith('-') && !input) {
      showGroup = true;
      target = gid;
      groupId = gid;
    }

    if (showGroup) {
      if (db.groups[target]) {
        const props = [
          'title',
          'username',
          'description',
          'member_count',
          'invite_link',
          'is_channel',
          'is_scam',
          'date',
          'restriction_reason',
          'linked_chat_id',
        ];
        for (const prop of props) {
          if (db.groups[target][prop]) {
            group[prop] = db.groups[target][prop];
          }
        }
      }

      if (target == gid && this.bot.config.bindings == 'TelegramTDlibBindings') {
        chat = await this.bot.bindings['serverRequest']('getChat', { chat_id: target }, true);
        info = await this.bot.bindings['serverRequest']('getSupergroup', { supergroup_id: target.slice(4) }, true);
        infoFull = await this.bot.bindings['serverRequest'](
          'getSupergroupFullInfo',
          {
            supergroup_id: target.slice(4),
          },
          true,
        );
        logger.info(`chat: ${JSON.stringify(chat)}`);
        logger.info(`info: ${JSON.stringify(info)}`);
        logger.info(`infoFull: ${JSON.stringify(infoFull)}`);
      }

      if (chat) {
        if (chat.title && chat.title.length > 0) {
          group.title = chat.title;
        }
      }

      if (info) {
        if (info.username && info.username.length > 0) {
          group.username = info.username;
        }
        if (info.member_count) {
          group.member_count = info.member_count;
        }
        if (info.is_channel) {
          group.is_channel = info.is_channel;
        }
        if (info.is_scam) {
          group.is_scam = info.is_scam;
        }
        if (info.date) {
          group.date = info.date;
        }
        if (info.restriction_reason && info.restriction_reason.length > 0) {
          group.restriction_reason = info.restriction_reason;
        }
      }
      if (infoFull) {
        if (infoFull.description && infoFull.description.length > 0) {
          group.description = infoFull.description;
        }
        if (infoFull.invite_link && infoFull.invite_link.length > 0) {
          group.invite_link = infoFull.invite_link;
        }
        if (infoFull.linked_chat_id) {
          group.linked_chat_id = infoFull.linked_chat_id;
        }
      }
      logger.info(`group: ${JSON.stringify(group)}`);
      db.groups[target] = group;
      db.groupsSnap.child(target).ref.set(group);
      const tags = getTags(this.bot, groupId);
      if (tags && tags.length > 0) {
        groupTags = tags.join(', ');
      }
    }

    if (Object.keys(user).length > 0) {
      let name = '';
      if (user.first_name) {
        name += user.first_name;
      }
      if (user.last_name) {
        name += ` ${user.last_name}`;
      }
      if (user.username && user.username.length > 0) {
        name += `\n\t     @${user.username}`;
      }
      text = `👤 ${name}\n🆔 ${userId}`;
      if (user.nick) {
        text += `\n💬 ${user.nick}`;
      }
      if (user.is_scam) {
        text += `\n⚠️ ${this.strings.reported}`;
      }
      if (user.is_bot) {
        text += `\n🤖 ${this.strings.bot}`;
      }
      if (userTags && userTags.length > 0) {
        text += `\n🏷 ${userTags}`;
      }
      if (user.description && user.description.length > 0) {
        text += `\nℹ️ ${user.description}`;
      }
    }
    if (text.length > 0) {
      text += '\n\n';
    }
    if (Object.keys(group).length > 0) {
      let name = group.title;
      if (group.username && group.username.length > 0) {
        name += `\n\t     @${group.username}`;
      }
      text += `👥 ${name}\n🆔 ${groupId}`;
      if (group.member_count && group.member_count > 0) {
        text += `\n👪 ${formatNumber(group.member_count)}`;
      }
      if (group.linked_chat_id && group.linked_chat_id < 0) {
        let title;
        if (db.groups[group.linked_chat_id]) {
          title = db.groups[group.linked_chat_id].title;
        }
        if (title) {
          text += `\n🗨️ ${title} [<code>${group.linked_chat_id}</code>]`;
        } else {
          text += `\n🗨️ <code>${group.linked_chat_id}</code>`;
        }
      }
      if (group.date && group.date > 0) {
        text += `\n📅 ${formatDate(group.date)}`;
      }
      if (group.invite_link && group.invite_link.length > 0) {
        text += `\n🔗 ${telegramShortLink(group.invite_link)}`;
      }
      if (groupTags && groupTags.length > 0) {
        text += `\n🏷 ${groupTags}`;
      }
      if (group.is_channel) {
        text += `\n📢 ${this.strings.channel}`;
      }
      if (group.is_scam) {
        text += `\n⚠️ ${this.strings.reported}`;
      }
      if (group.restriction_reason && group.restriction_reason.length > 0) {
        text += `\n🚫 <i>${group.restriction_reason}</i>`;
      }
      if (group.description && group.description.length > 0) {
        text += `\nℹ️ <i>${group.description}</i>`;
      }
    }

    this.bot.replyMessage(msg, text);
  }
}
