import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { DatabaseConversation, DatabaseUser } from '../types';
import { formatDate, formatNumber, getInput, getTags, getTarget, isInt, logger, telegramShortLink } from '../utils';
import { db } from '../main';

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
    let target = await getTarget(this.bot, msg, input);

    let text = '';
    const user_: DatabaseUser = {};
    const group_: DatabaseConversation = {};
    let showGroup = false;
    let chat, info, infoFull, userId, groupId, userTags, groupTags;

    /*if (this.bot.platform == 'telegram') {
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
    }*/

    const users = db[this.bot.platform].collection('users');
    const user = await users.findOne({ id: target });
    const groups = db[this.bot.platform].collection('groups');
    const group = await groups.findOne({ id: target });

    if (!target || (target && !(user || group || !isInt(target) || info || chat))) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    if (target) {
      if (!String(target).startsWith('-')) {
        userId = target;
        if (user) {
          const props = ['first_name', 'last_name', 'username', 'nick', 'description', 'is_bot', 'is_scam'];
          props.map((prop) => {
            if (user[prop]) {
              user_[prop] = user[prop];
            }
          });
        }

        if (info) {
          userId = info.id;
          if (info.first_name && info.first_name.length > 0) {
            user_.first_name = info.first_name;
          }
          if (info.last_name && info.last_name.length > 0) {
            user_.last_name = info.last_name;
          }
          if (info.username && info.username.length > 0) {
            user_.username = info.username;
          }
          if (info.is_scam) {
            user_.is_scam = info.is_scam;
          }
          user_.is_bot = info.type._ == 'userTypeBot';
        }
        if (infoFull) {
          user_.description = info.bio || '';
        }
        logger.info(`user: ${JSON.stringify(user_)}`);
        users.updateOne({ id: target }, { $set: user_ });
        const tags = await getTags(this.bot, userId);
        if (tags && tags.length > 0) {
          userTags = tags;
        }

        if (!input) {
          target = gid;
          groupId = gid;
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
      if (group) {
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
        props.map((prop) => {
          if (group[prop]) {
            group_[prop] = group[prop];
          }
        });
      }

      /*if (target == gid && this.bot.platform == 'telegram') {
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
      }*/

      if (chat) {
        if (chat.title && chat.title.length > 0) {
          group_.title = chat.title;
        }
      }

      if (info) {
        if (info.username && info.username.length > 0) {
          group_.username = info.username;
        }
        if (info.member_count) {
          group_.member_count = info.member_count;
        }
        if (info.is_channel) {
          group_.is_channel = info.is_channel;
        }
        if (info.is_scam) {
          group_.is_scam = info.is_scam;
        }
        if (info.date) {
          group_.date = info.date;
        }
        if (info.restriction_reason && info.restriction_reason.length > 0) {
          group_.restriction_reason = info.restriction_reason;
        }
      }
      if (infoFull) {
        if (infoFull.description && infoFull.description.length > 0) {
          group_.description = infoFull.description;
        }
        if (infoFull.invite_link && infoFull.invite_link.length > 0) {
          group_.invite_link = infoFull.invite_link;
        }
        if (infoFull.linked_chat_id) {
          group_.linked_chat_id = infoFull.linked_chat_id;
        }
      }
      logger.info(`group: ${JSON.stringify(group_)}`);
      groups.updateOne({ id: target }, { $set: group_ });

      const tags = await getTags(this.bot, groupId);
      if (tags && tags.length > 0) {
        groupTags = tags;
      }
    }

    if (Object.keys(user_).length > 0) {
      text = '👤 ';
      if (user_.first_name) {
        text += user_.first_name;
      }
      if (user_.last_name) {
        text += ` ${user_.last_name}`;
      }
      if (user_.username && user_.username.length > 0) {
        text += `\n↗️ @${user_.username}`;
      }
      text += `\n🆔 ${userId}`;
      if (user_.nick) {
        text += `\n💬 ${user_.nick}`;
      }
      if (user_.is_scam) {
        text += `\n⚠️ ${this.strings.reported}`;
      }
      if (user_.is_bot) {
        text += `\n🤖 ${this.strings.bot}`;
      }
      if (userTags && userTags.length > 0) {
        text += `\n🏷 <code>${userTags.join('</code>\n🏷 <code>')}</code>`;
      }
      if (user_.description && user_.description.length > 0) {
        text += `\nℹ️ ${user_.description}`;
      }
    }
    if (text.length > 0) {
      text += '\n\n';
    }
    if (Object.keys(group_).length > 0) {
      text += `👥 ${group_.title}`;
      if (group_.username && group_.username.length > 0) {
        text += `\n↗️ @${group_.username}`;
      }
      text += `\n🆔 ${groupId}`;
      if (group_.member_count && group_.member_count > 0) {
        text += `\n👪 ${formatNumber(group_.member_count)}`;
      }
      if (group_.linked_chat_id && group_.linked_chat_id < 0) {
        let title;
        const linkedChat = await groups.findOne({ id: group.linked_chat_id });
        if (linkedChat) {
          title = linkedChat.title;
        }
        if (title) {
          text += `\n🗨️ ${title} [<code>${group.linked_chat_id}</code>]`;
        } else {
          text += `\n🗨️ <code>${group.linked_chat_id}</code>`;
        }
      }
      if (group_.date && group_.date > 0) {
        text += `\n📅 ${formatDate(group_.date)}`;
      }
      if (group_.invite_link && group_.invite_link.length > 0) {
        text += `\n🔗 ${telegramShortLink(group_.invite_link)}`;
      }
      if (groupTags && groupTags.length > 0) {
        text += `\n🏷 <code>${groupTags.join('</code>\n🏷 <code>')}</code>`;
      }
      if (group_.is_channel) {
        text += `\n📢 ${this.strings.channel}`;
      }
      if (group_.is_scam) {
        text += `\n⚠️ ${this.strings.reported}`;
      }
      if (group_.restriction_reason && group_.restriction_reason.length > 0) {
        text += `\n🚫 <i>${group_.restriction_reason}</i>`;
      }
      if (group_.description && group_.description.length > 0) {
        text += `\nℹ️ <i>${group_.description}</i>`;
      }
    }

    this.bot.replyMessage(msg, text);
  }
}
