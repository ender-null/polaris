import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { DatabaseConversation, DatabaseUser } from '../types';
import { getFullName, getInput, getTags, getTarget, logger } from '../utils';

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
    let info, infoFull, userTags, groupTags;

    if (target && +target > 0) {
      info = this.bot.bindings['serverRequest']('getUser', { user_id: target });
      infoFull = this.bot.bindings['serverRequest']('getUserFullInfo', { user_id: target });
    } else if (target && target.startsWith('-100')) {
      info = this.bot.bindings['serverRequest']('getSupergroup', { supergroup_id: target.slice(4) });
      infoFull = this.bot.bindings['serverRequest']('getSupergroupFullInfo', { supergroup_id: target.slice(4) });
    } else {
      info = this.bot.bindings['serverRequest']('getChat', { chat_id: target });
    }

    if (target && (+target == 0 || !(db.users[target] || db.users[target] || info))) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    if (target) {
      if (+target > 0) {
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
            db.users[target] = {
              first_name: info['first_name'] || null,
              last_name: info['last_name'] || null,
            };
          }
        }

        if (info) {
          user.first_name = info['first_name'] || null;
          user.last_name = info['last_name'] || null;
          if (info['username'] && info['username'].length > 0) {
            user.username = info['username'];
            db.users[target].username = user.username;
          }
        }
        if (infoFull) {
          user.description = infoFull['bio'] || null;
          db.users[target].description = user.description;
        }
        logger.info(JSON.stringify(db.users[target]));
        db.usersSnap.child(target).ref.set(db.users[target]);
        const tags = getTags(this.bot, target);
        if (tags && tags.length > 0) {
          userTags = tags.join(', ');
        }
      } else {
        showGroup = true;
      }
    } else {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }

    if (+gid < 0 && !getInput(msg)) {
      showGroup = true;
      target = gid;
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
          db.groups[target] = {
            title: info['title'] || null,
          };
        }
      }

      if (info) {
        if (info['username'] && info['username'].length > 0) {
          group.username = info['username'] || null;
          db.groups[target].username = group.username;
        }
      }
      if (infoFull) {
        group.description = infoFull['description'] || null;
        group.member_count = infoFull['member_count'] || 0;
        group.invite_link = infoFull['invite_link'] || null;
        db.groups[target].description = group.description;
        db.groups[target].member_count = group.member_count;
        db.groups[target].invite_link = group.invite_link;
      }
      logger.info(JSON.stringify(db.groups[target]));
      db.groupsSnap.child(target).ref.set(db.groups[target]);
      const tags = getTags(this.bot, target);
      if (tags && tags.length > 0) {
        groupTags = tags.join(', ');
      }
    }

    if (Object.keys(user).length > 0) {
      let name = getFullName(target, false);
      if (user.username && user.username.length > 0) {
        name += `\n\t     @${user.username}`;
      }
      text = `👤 ${name}\n🆔 ${target}`;
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
      text += `👥 ${name}\n🆔 ${target}`;
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
