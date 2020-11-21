import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { getTags, hasTag, logger, sendRequest, telegramLinkRegExp } from '../utils';

export class MediaForwarderPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
  }

  async always(msg: Message): Promise<void> {
    const gid = String(msg.conversation.id);

    if (msg.sender['isBot']) {
      logger.info(`ignoring bot: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (msg.sender.id == 777000) {
      logger.info(`ignoring anonymous message: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (hasTag(this.bot, msg.sender.id, 'muted')) {
      logger.info(`ignoring muted user: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (msg.extra.replyMarkup) {
      logger.info(`ignoring reply markup: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (msg.extra.viaBotUserId) {
      const uid = String(msg.extra.viaBotUserId);
      let name = null;
      if (db.users[uid]) {
        name = db.users[uid].first_name;
      }

      logger.info(`ignoring message via bot: ${name} [${uid}]`);
      return;
    }

    if (hasTag(this.bot, gid, 'resend:?') || hasTag(this.bot, gid, 'fwd:?')) {
      for (const tag of getTags(this.bot, gid)) {
        let forward = false;
        if (tag.startsWith('resend:') || tag.startsWith('fwd:')) {
          const cid = tag.split(':')[1];
          if (msg.extra.fromChatId) {
            if (String(msg.extra['from_chat_id']) == String(cid)) {
              break;
            } else if (String(msg.extra.fromChatId) != '0') {
              if (hasTag(this.bot, cid, 'resend:?') || hasTag(this.bot, cid, 'fwd:?')) {
                logger.info('forward');
                forward = true;
              }
            }
          }
          logger.info(`tag: {tag}, forward: {forward}`);
        }
        if (tag.startsWith('resend:') && !forward) {
          const cid = tag.split(':')[1];

          if (
            msg.type == 'photo' ||
            msg.type == 'video' ||
            msg.type == 'animation' ||
            msg.type == 'document' ||
            (msg.type == 'text' && msg.extra.urls)
          ) {
            const r: Message = { ...msg };
            r.conversation.id = cid;
            r.conversation.title = tag;
            if (r.extra.urls) {
              for (let url of r.extra.urls) {
                const inputMatch = telegramLinkRegExp.exec(url);
                if (inputMatch && inputMatch.length > 0) {
                  logger.info(`ignoring telegram url: ${url}`);
                } else {
                  if (url.indexOf('instagram') > -1) {
                    url = url.split('?')[0];
                  }
                }
                this.bot.replyMessage(r, url, 'text', null, { preview: true });
              }
            } else {
              this.bot.replyMessage(r, msg.content, msg.type, null, { preview: true });
            }
          } else if (msg.type != 'text') {
            logger.info(`invalid type: ${msg.type}`);
          }
        } else if (tag.startsWith('fwd:') || forward) {
          const cid = tag.split(':')[1];
          if (
            msg.type == 'photo' ||
            msg.type == 'video' ||
            msg.type == 'animation' ||
            msg.type == 'document' ||
            (msg.type == 'text' && msg.extra.urls)
          ) {
            this.bot.forwardMessage(msg, cid);
          }
        }
      }
    }

    if (hasTag(this.bot, gid, 'discord:?')) {
      for (const tag of getTags(this.bot, gid, 'discord:?')) {
        const token = tag.split(':')[1];
        const webhookUrl = `https://discord.com/api/webhooks/${token}`;
        if (
          msg.type == 'photo' ||
          msg.type == 'video' ||
          msg.type == 'animation' ||
          msg.type == 'document' ||
          (msg.type == 'text' && msg.extra.urls)
        ) {
          if (msg.extra.urls) {
            for (let url of msg.extra.urls) {
              const inputMatch = telegramLinkRegExp.exec(url);
              if (inputMatch && inputMatch.length > 0) {
                logger.info(`ignoring telegram url: ${url}`);
              } else {
                if (url.indexOf('instagram') > -1) {
                  url = url.split('?')[0];
                }
              }
              await sendRequest(webhookUrl, { content: url }, null, null, true);
            }
          } else {
            if (msg.content.startsWith('http')) {
              await sendRequest(webhookUrl, { content: msg.content }, null, null, true);
            } else {
              const file = await this.bot.bindings.getFile(msg.content);
              // TODO
              if (file) {
                await sendRequest(webhookUrl, { content: file }, null, null, true);
              }
            }
          }
        }
      }
    }
  }
}
