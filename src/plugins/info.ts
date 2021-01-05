import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { DatabaseConversation, DatabaseUser } from '../types';
import { getFullName, getInput, getTags, getTarget, isInt, logger } from '../utils';

export class InfoPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/info',
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
  }
  async run(msg: Message): Promise<void> {
    const gid = String(msg.conversation.id);
    const input = getInput(msg, false);
    let target = getTarget(this.bot, msg, input);

    let text = '';
    const user: DatabaseUser = {};
    const group: DatabaseConversation = {};
    let showGroup = false;
    let info, infoFull, userId, groupId, userTags, groupTags;

    logger.info(`target: ${target}`);
    if (target && isInt(target) && +target > 0) {
      info = this.bot.bindings['serverRequest']('getUser', { user_id: target });
      infoFull = this.bot.bindings['serverRequest']('getUserFullInfo', { user_id: target });
    } else if (target && isInt(target) && target.startsWith('-100')) {
      info = this.bot.bindings['serverRequest']('getSupergroup', { supergroup_id: target.slice(4) });
      infoFull = this.bot.bindings['serverRequest']('getSupergroupFullInfo', { supergroup_id: target.slice(4) });
    } else {
      info = this.bot.bindings['serverRequest']('getChat', { chat_id: target });
    }
    logger.info(`info: ${JSON.stringify(info)}`);
    logger.info(`infoFull: ${JSON.stringify(infoFull)}`);

    if (target && (+target == 0 || !(db.users[target] || db.users[target] || info))) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    if (target) {
      if (+target > 0) {
        userId = target;
        if (db.users[target]) {
          if (db.users[target].first_name) {
            user.first_name = db.users[target].first_name;
          }
          if (db.users[target].last_name) {
            user.last_name = db.users[target].last_name;
          }
          if (db.users[target].username) {
            user.username = db.users[target].username;
          }
          if (db.users[target].description) {
            user.description = db.users[target].description;
          }
        } else {
          if (info) {
            db.users[target] = {};
          }
        }

        if (info) {
          if (info['first_name'] && info['first_name'].length > 0) {
            user.first_name = info['first_name'];
            db.users[target].first_name = user.first_name;
          }
          if (info['last_name'] && info['last_name'].length > 0) {
            user.last_name = info['last_name'];
            db.users[target].last_name = user.last_name;
          }
          if (info['username'] && info['username'].length > 0) {
            user.username = info['username'];
            db.users[target].username = user.username;
          }
        }
        if (infoFull) {
          if (info['bio'] && info['bio'].length > 0) {
            user.description = info['bio'];
            db.users[target].description = user.description;
          }
        }
        logger.info(JSON.stringify(db.users[target]));
        db.usersSnap.child(target).ref.set(db.users[target]);
        const tags = getTags(this.bot, userId);
        if (tags && tags.length > 0) {
          userTags = tags.join(', ');
        }
      } else {
        showGroup = true;
        groupId = gid;
      }
    } else {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    if (+gid < 0 && !getInput(msg)) {
      showGroup = true;
      target = gid;
      groupId = target;
    }

    if (showGroup) {
      if (db.groups[target]) {
        if (db.groups[target].title) {
          group.title = db.groups[target].title;
        }
        if (db.groups[target].username) {
          group.username = db.groups[target].username;
        }
        if (db.groups[target].description) {
          group.description = db.groups[target].description;
        }
        if (db.groups[target].member_count) {
          group.member_count = db.groups[target].member_count;
        }
        if (db.groups[target].invite_link) {
          group.invite_link = db.groups[target].invite_link;
        }
      } else {
        if (info) {
          db.groups[target] = {};
        }
      }

      if (info) {
        if (info['title'] && info['title'].length > 0) {
          group.title = info['title'];
          db.groups[target].username = group.title;
        }
        if (info['username'] && info['username'].length > 0) {
          group.username = info['username'] || null;
          db.groups[target].username = group.username;
        }
      }
      if (infoFull) {
        group.description = infoFull['description'] || '';
        db.groups[target].description = group.description;
        group.member_count = infoFull['member_count'] || 0;
        db.groups[target].member_count = group.member_count;
        group.invite_link = infoFull['invite_link'] || '';
        db.groups[target].invite_link = group.invite_link;
      }
      logger.info(JSON.stringify(db.groups[target]));
      db.groupsSnap.child(target).ref.set(db.groups[target]);
      const tags = getTags(this.bot, groupId);
      if (tags && tags.length > 0) {
        groupTags = tags.join(', ');
      }
    }

    if (Object.keys(user).length > 0) {
      let name = getFullName(userId, false);
      if (user.username && user.username.length > 0) {
        name += `\n\t     @${user.username}`;
      }
      text = `👤 ${name}\n🆔 ${userId}`;
      if (userTags && userTags.length > 0) {
        text += `\n🏷 ${userTags}`;
      }
      if (user.description && user.description.length > 0) {
        text += '\n\n${user.description}';
      }
    }
    if (text.length > 0) {
      text += '\n';
    }
    if (Object.keys(group).length > 0) {
      let name = group.title;
      if (group.username && group.username.length > 0) {
        name += `\n\t     @${group.username}`;
      }
      text += `👥 ${name}\n🆔 ${groupId}`;
      if (group.invite_link && group.invite_link.length > 0) {
        text += '\n🔗 ${group.invite_link}';
      }
      if (groupTags && groupTags.length > 0) {
        text += `\n🏷 ${userTags}`;
      }
      if (group.description && group.description.length > 0) {
        text += '\n\n${group.description}';
      }
    }

    this.bot.replyMessage(msg, text);
  }
}
