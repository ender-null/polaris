import format from 'string-format';
import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import {
  delTag,
  fixTelegramLink,
  getFullName,
  hasTag,
  isAdmin,
  isGroupAdmin,
  isTrusted,
  setTag,
  telegramLinkRegExp,
} from '../utils';

export class AntiSpamPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.strings = {
      marked: 'Marked as {0}: {1} [{2}] from group {3} [{4}] for {5}: {6}',
      markedGroup: 'Marked group as {0}: {1} [{2}]',
      unmarking: 'Unmarking {0}: {1} [{2}] from group {3} [{4}]',
      kicked: 'Kicked {0}: {1} [{2}] from group {3} [{4}] for {5}: {6}',
      kickedMyself: 'Kicked myself from: {0} [{1}]',
      cantKickMyself: "Can't kick myself from: {0} [{1}]",
      unsafeTelegramLink: 'Sent unsafe telegram link: {0} [{1}] to group {2} [{3}] for text: {4}',
    };
  }

  async always(msg: Message): Promise<void> {
    if (
      msg.conversation.id == this.bot.config.alertsConversationId ||
      msg.conversation.id == this.bot.config.adminConversationId
    ) {
      return;
    }

    if (await hasTag(this.bot, msg.sender.id, `ban:${msg.conversation.id}`)) {
      await this.kickSpammer(msg, 'ban', 'id');
    }

    const spamTypes = ['spam', 'arab', 'russian', 'ethiopic'];
    spamTypes.map(async (spamType) => {
      if (!(await hasTag(this.bot, msg.sender.id, `allow${spamType}`))) {
        if (await hasTag(this.bot, msg.sender.id, spamType)) {
          if (!isAdmin(this.bot, msg.sender.id, msg)) {
            await this.kickSpammer(msg, spamType, 'tag');
          } else if (isTrusted(this.bot, msg.sender.id, msg)) {
            delTag(this.bot, msg.sender.id, spamType);
            const name = await getFullName(this.bot, msg.sender.id);
            const gid = String(msg.conversation.id);
            this.bot.sendAdminAlert(
              format(
                this.strings['unmarking'],
                spamType,
                name,
                msg.sender.id,
                db.groups[gid] ? db.groups[gid].title : '[no title]',
                gid,
              ),
            );
          }
        }
        if (
          String(msg.conversation.id).startsWith('-') &&
          (await hasTag(this.bot, msg.conversation.id, spamType)) &&
          !(await hasTag(this.bot, msg.conversation.id, 'safe')) &&
          !(await hasTag(this.bot, msg.conversation.id, 'resend:?')) &&
          !(await hasTag(this.bot, msg.conversation.id, 'fwd:?'))
        ) {
          return await this.kickMyself(msg);
        }
      }
    });

    if (msg.extra) {
      if (msg.extra.urls) {
        msg.extra.urls.map((url) => {
          this.checkTrustedTelegramLink(msg, fixTelegramLink(url));
        });
      }
      if (msg.extra.caption && msg.extra.caption) {
        if (this.detectArab(msg.extra.caption)) {
          await this.kickSpammer(msg, 'arab', 'caption');
        }
        if (this.detectRussian(msg.extra.caption)) {
          await this.kickSpammer(msg, 'russian', 'caption');
        }
        if (this.detectEthiopic(msg.extra.caption)) {
          await this.kickSpammer(msg, 'ethiopic', 'caption');
        }
        await this.checkTrustedTelegramLink(msg, msg.extra.caption);
      }

      if (
        !(await hasTag(this.bot, msg.conversation.id, 'safe')) &&
        !(await hasTag(this.bot, msg.conversation.id, 'resend:?')) &&
        !(await hasTag(this.bot, msg.conversation.id, 'fwd:?'))
      ) {
        if (msg.type == 'text') {
          if (this.detectArab(msg.content)) {
            await this.kickSpammer(msg, 'arab', 'content');
          }
          if (this.detectRussian(msg.content)) {
            await this.kickSpammer(msg, 'russian', 'content');
          }
          if (this.detectEthiopic(msg.content)) {
            await this.kickSpammer(msg, 'ethiopic', 'content');
          }
        }
        if (msg.sender.constructor.name == 'User') {
          if (this.detectArab(msg.sender['first_name'])) {
            await this.kickSpammer(msg, 'arab', 'name');
          }
          if (this.detectRussian(msg.sender['first_name'])) {
            await this.kickSpammer(msg, 'russian', 'name');
          }
          if (this.detectEthiopic(msg.sender['first_name'])) {
            await this.kickSpammer(msg, 'ethiopic', 'name');
          }
        }
      }
    }
  }

  async kickSpammer(m: Message, spamType = 'spam', content = 'content'): Promise<void> {
    const uid = String(m.sender.id);
    const gid = String(m.conversation.id);
    const name = await getFullName(this.bot, uid);
    const groups = db[this.bot.platform].collection('groups');
    const group = await groups.findOne({ id: gid });
    let text;
    if (content == 'name') {
      text = m.sender['first_name'];
    } else if (content == 'title') {
      text = m.conversation ? m.conversation.title : '[no title]';
    } else if (content == 'caption') {
      text = m.extra.caption;
    } else if (content == 'id') {
      text = m.sender.id;
    } else {
      text = m.content;
    }
    if (
      spamType != 'ban' &&
      !(await hasTag(this.bot, uid, spamType)) &&
      !(await hasTag(this.bot, uid, `allow${spamType}`))
    ) {
      this.bot.sendAdminAlert(
        format(
          this.strings['marked'],
          spamType,
          name,
          m.sender.id,
          group ? group.title : '[no title]',
          gid,
          content,
          text,
        ),
      );
      setTag(this.bot, uid, spamType);
      if (group[spamType]) {
        group[spamType] = db.groups[gid][spamType] + 1;
        groups.updateOne({ id: gid }, { $set: group });
      } else {
        db.groups[gid][spamType] = 1;
        groups.insertOne(group);
      }

      if (group[spamType] >= 10 || uid == gid) {
        setTag(this.bot, gid, spamType);
        this.bot.sendAdminAlert(format(this.strings.markedGroup, spamType, group ? group.title : '[no title]', gid));
        if (
          !(await hasTag(this.bot, gid, 'safe')) &&
          !(await hasTag(this.bot, gid, 'resend:?')) &&
          !(await hasTag(this.bot, gid, 'fwd:?'))
        ) {
          await this.kickMyself(m);
        }
      }
    }

    if (
      isGroupAdmin(this.bot, this.bot.user.id, m) &&
      !isAdmin(this.bot, uid) &&
      ((await hasTag(this.bot, gid, 'anti' + spamType)) || spamType == 'ban')
    ) {
      await this.bot.bindings.kickConversationMember(gid, uid);
      this.bot.sendAdminAlert(
        format(this.strings['kicked'], spamType, name, uid, group ? group.title : '[no title]', gid, content, text),
      );
      this.bot.replyMessage(m, this.bot.errors.idiotKicked);
      this.bot.bindings.deleteMessage(gid, m.id);
    }
  }

  async kickMyself(msg: Message): Promise<void> {
    const res = await this.bot.bindings.leaveConversation(msg.conversation.id);
    const gid = String(msg.conversation.id);
    if (res) {
      this.bot.sendAdminAlert(
        format(this.strings.kickedMyself, db.groups[gid] ? db.groups[gid].title : '[no title]', gid),
      );
    } else {
      this.bot.sendAdminAlert(
        format(this.strings.cantKickMyself, db.groups[gid] ? db.groups[gid].title : '[no title]', gid),
      );
    }
  }

  async checkTrustedTelegramLink(m: Message, text: string): Promise<void> {
    const inputMatch = telegramLinkRegExp.exec(text);
    if (inputMatch && inputMatch.length > 0) {
      let trustedGroup = false;
      if (inputMatch && inputMatch.length > 0) {
        const groupHash = inputMatch[1];
        Object.keys(db.administration).map((gid) => {
          const group = db.administration[gid];
          if (group && group.link && group.link.indexOf(groupHash) > -1) {
            trustedGroup = true;
            return;
          }
        });
      }
      if (trustedGroup && !isAdmin(this.bot, m.sender.id, m)) {
        const name = await getFullName(this.bot, m.sender.id);
        const gid = String(m.conversation.id);
        this.bot.sendAdminAlert(
          format(
            this.strings.unsafeTelegramLink,
            name,
            m.sender.id,
            db.groups[gid] ? db.groups[gid].title : '[no title]',
            gid,
            text,
          ),
        );
        await this.kickSpammer(m, 'spam', 'link');
      }
    }
  }

  isTrustedGroup(m: Message): boolean {
    if (db.administration) {
      for (const gid in db.administration) {
        if (String(m.conversation.id) == gid) {
          return true;
        }
      }
    }

    return false;
  }

  detectArab(text: string): boolean {
    if (new RegExp('(.*[\u0600-\u06FF]){3,}', 'gim').test(text)) {
      return true;
    }
    if (new RegExp('\u202E', 'gim').test(text)) {
      return true;
    }
    if (new RegExp('\u200F', 'gim').test(text)) {
      return true;
    }
    return false;
  }

  detectRussian(text: string): boolean {
    if (new RegExp('(.*[А-Яа-яЁё]){3,}', 'gim').test(text)) {
      return true;
    }
    return false;
  }

  detectEthiopic(text: string): boolean {
    if (new RegExp('(.*[\u1200-\u137F]){3,}', 'gim').test(text)) {
      return true;
    }
    return false;
  }
}
