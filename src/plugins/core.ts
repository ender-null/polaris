import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { fixTelegramLink, logger, telegramLinkRegExp } from '../utils';

export class CorePlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
  }
  async run(msg: Message): Promise<void> {
    this.bot.replyMessage(msg, null);
  }

  async always(msg: Message): Promise<void> {
    if (
      msg.conversation.id == this.bot.config.alertsConversationId ||
      msg.conversation.id == this.bot.config.adminConversationId
    ) {
      return;
    }

    if (msg.sender.id == 777000 && msg.conversation.id > 0) {
      const inputMatch = new RegExp('d{5}').exec(msg.content);
      if (inputMatch && inputMatch.length > 0) {
        const code = inputMatch[0].split('').join('\u200c');
        this.bot.sendAlert(`Login code: ${code}`);
      }
    }

    const urls = [];
    if (msg.extra && msg.extra.urls) {
      urls.push(...msg.extra['urls']);
    }

    if (msg.extra && msg.extra.replyMarkup && msg.extra.replyMarkup['@type'] == 'replyMarkupInlineKeyboard') {
      for (const row of msg.extra.replyMarkup.rows) {
        for (const btn of row) {
          if (btn.type == 'inlineKeyboardButtonTypeUrl') {
            urls.push(btn.url);
          }
        }
      }
    }

    for (const url in urls) {
      const inputMatch = telegramLinkRegExp.exec(url);
      if (inputMatch && inputMatch.length > 0) {
        const fixedUrl = fixTelegramLink(url);

        let knownLink = false;
        for (const gid in db.groups) {
          if (db.groups[gid].invite_link && db.groups[gid].invite_link == fixedUrl) {
            knownLink = true;
            logger.info(`known link: {fixedUrl}`);
            break;
          }
        }

        if (!knownLink) {
          const chat = this.bot.bindings.checkInviteLink(fixedUrl);
          if (chat) {
            if (chat['chat_id'] == 0) {
              const ok = this.bot.bindings.joinByInviteLink(fixedUrl);
              if (ok) {
                const cid = ok['id'];
                this.bot.sendAdminAlert(`Joined ${ok['title']} [${cid}] by invite link: ${fixedUrl}`);
                if (db.groups[cid] != undefined) {
                  db.groupsSnap.child(cid).ref.update({
                    invite_link: fixedUrl,
                    member_count: chat['member_count'] || 0,
                    title: ok['title'],
                  });
                } else {
                  db.groupsSnap.child(cid).ref.set({
                    invite_link: fixedUrl,
                    member_count: chat['member_count'] || 0,
                    title: ok['title'],
                  });
                }
              }
            }
          } else {
            logger.info(`invalid link: {fixedUrl}`);
          }
        }
      }
    }
  }
}
