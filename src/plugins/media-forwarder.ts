import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import {
  delTag,
  generateCommandHelp,
  getFullName,
  getInput,
  getTags,
  getWord,
  hasTag,
  isCommand,
  isInt,
  logger,
  sendRequest,
  setTag,
  telegramLinkRegExp,
} from '../utils';

export class MediaForwarderPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/resends',
        hidden: true,
      },
      {
        command: '/resend',
        parameters: [
          {
            name: 'origin',
            required: true,
          },
          {
            name: 'destination',
            required: true,
          },
        ],
        description: 'Resend all media from origin to destination',
        hidden: true,
      },
      {
        command: '/rmresend',
        parameters: [
          {
            name: 'origin',
            required: true,
          },
        ],
        description: 'Remove all resends from origin',
        hidden: true,
      },
      {
        command: '/cleanresends',
        description: 'Remove all resends from unknown groups',
        hidden: true,
      },
    ];
    this.strings = {
      resends: 'Resends',
      forwards: 'Forwards',
    };
  }

  async run(msg: Message): Promise<void> {
    const ids = {
      nsfw: -1001230470587,
      hentai: -1001495126561,
      porn: -1001409180171,
    };
    const clean = isCommand(this, 4, msg.content);
    if (isCommand(this, 1, msg.content) || clean) {
      const resends = [];
      const forwards = [];
      const removedResends = [];
      const removedForwards = [];

      let text = '';

      Object.keys(db.tags).map((gid) => {
        getTags(this.bot, gid).map((tag) => {
          if (tag.indexOf('resend:') > -1) {
            resends.push(`${gid}:${tag.split(':')[1]}`);
          }
          if (tag.indexOf('fwd:') > -1) {
            forwards.push(`${gid}:${tag.split(':')[1]}`);
          }
        });
      });

      if (clean) {
        resends.map((item) => {
          const orig = item.split(':')[0];
          const dest = item.split(':')[1];
          if (!db.groups[orig] || !db.groups[dest]) {
            delTag(this.bot, orig, `resend:${dest}`);
            removedResends.push(item);
          }
        });
        forwards.map((item) => {
          const orig = item.split(':')[0];
          const dest = item.split(':')[1];

          if (!db.groups[orig] || !db.groups[dest]) {
            delTag(this.bot, orig, `fwd:${dest}`);
            removedForwards.push(item);
          }
        });
      }

      if (!clean) {
        if (resends.length > 0) {
          text += `<b>${this.strings.resends}:</b>`;
          text += this.generateText(resends);
        }

        if (forwards.length > 0) {
          text += `\n<b>${this.strings.forwards}:</b>`;
          text += this.generateText(forwards);
        }
      } else {
        if (removedResends.length > 0) {
          text += `<b>${this.strings.resends}:</b>`;
          text += this.generateText(removedResends);
        }

        if (removedForwards.length > 0) {
          text += `\n<b>${this.strings.forwards}:</b>`;
          text += this.generateText(removedForwards);
        }
      }

      this.bot.replyMessage(msg, text);
    } else if (isCommand(this, 2, msg.content)) {
      const input = getInput(msg, false);
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      const orig = getWord(input, 1);
      let dest = getWord(input, 2);
      if (ids[dest]) {
        dest = ids[dest];
      }
      if (!isInt(orig) || !isInt(dest)) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      setTag(this.bot, orig, `resend:${dest}`);
      this.bot.replyMessage(msg, '✅');
    } else if (isCommand(this, 3, msg.content)) {
      const input = getInput(msg, false);
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      const orig = getWord(input, 1);
      delTag(this.bot, orig, 'resend:?');
      delTag(this.bot, orig, 'fwd:?');
      this.bot.replyMessage(msg, '✅');
    }
  }

  generateText(items: string[]): string {
    let text = '';
    items.map((item) => {
      const orig = item.split(':')[0];
      const dest = item.split(':')[1];

      text += '\n';
      if (db.groups[orig]) {
        text += `\t${db.groups[orig].title} [${orig}]`;
      } else {
        text += `\t${orig}`;
      }
      if (db.groups[dest]) {
        text += ` ➡️ ${db.groups[dest].title} [${dest}]`;
      } else {
        text += ` ➡️ ${dest}`;
      }

      text += '\n';
    });

    return text;
  }

  async always(msg: Message): Promise<void> {
    const gid = String(msg.conversation.id);

    if (msg.sender['isBot']) {
      logger.debug(`ignoring bot: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (msg.sender.id == 777000) {
      logger.debug(`ignoring anonymous message: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (hasTag(this.bot, msg.sender.id, 'muted')) {
      logger.debug(`ignoring muted user: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (msg.extra.replyMarkup) {
      logger.debug(`ignoring reply markup: ${msg.sender['firstName']} [${msg.sender.id}]`);
      return;
    }
    if (msg.extra.viaBotUserId) {
      const uid = String(msg.extra.viaBotUserId);
      let name = null;
      if (db.users[uid]) {
        name = db.users[uid].first_name;
      }
      logger.debug(`ignoring message via bot: ${name} [${uid}]`);
      return;
    }

    if (hasTag(this.bot, gid, 'resend:?') || hasTag(this.bot, gid, 'fwd:?')) {
      getTags(this.bot, gid).map((tag) => {
        let forward = false;
        if (tag.startsWith('resend:') || tag.startsWith('fwd:')) {
          const cid = tag.split(':')[1];
          if (msg.extra.fromChatId) {
            if (String(msg.extra['from_chat_id']) == String(cid)) {
              return;
            } else if (String(msg.extra.fromChatId) != '0') {
              if (hasTag(this.bot, cid, 'resend:?') || hasTag(this.bot, cid, 'fwd:?')) {
                logger.debug('forward');
                forward = true;
              }
            }
          }
          logger.debug(`tag: ${tag}, forward: ${forward}`);
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
            if (cid.startsWith('-')) {
              if (db.groups[cid]) {
                r.conversation.title = db.groups[cid].title;
              } else {
                r.conversation.title = tag.toUpperCase();
              }
            } else {
              if (db.users[cid]) {
                r.conversation.title = getFullName(cid);
              } else {
                r.conversation.title = tag.toUpperCase();
              }
            }
            r.conversation.title = tag.toUpperCase();
            if (r.extra.urls) {
              r.extra.urls.map(async (url) => {
                const inputMatch = telegramLinkRegExp.exec(url);
                if (inputMatch && inputMatch.length > 0) {
                  logger.debug(`ignoring telegram url: ${url}`);
                } else {
                  if (url.startsWith('https://twitter.com')) {
                    logger.debug(`tweet url: ${url}`);
                    const tweetIdPattern = new RegExp('status/(\\d+)', 'gim');
                    const twInputMatch = tweetIdPattern.exec(url);
                    if (twInputMatch && twInputMatch.length > 0) {
                      logger.debug(`tweet id: ${twInputMatch[1]}`);
                      const tweetResp = await sendRequest(
                        `https://on.my.end.works/twdl/getMediaUrls/${twInputMatch[1]}`,
                        null,
                        null,
                        null,
                        false,
                        this.bot,
                      );
                      if (tweetResp) {
                        const tweetContent = await tweetResp.json();
                        tweetContent.mediaUrls.forEach((mediaUrl: string) => {
                          logger.debug(`tweet media url: ${mediaUrl}`);
                          if (mediaUrl.includes('.mp4')) {
                            this.bot.replyMessage(r, mediaUrl, 'video');
                          } else {
                            this.bot.replyMessage(r, mediaUrl, 'photo');
                          }
                        });
                      }
                    }
                  } else {
                    if (url.indexOf('instagram') > -1) {
                      url = url.split('?')[0];
                    }
                    this.bot.replyMessage(r, url, 'text', null, { preview: true });
                  }
                }
              });
            } else {
              this.bot.replyMessage(r, msg.content, msg.type, null, { preview: true });
            }
          } else if (msg.type != 'text') {
            logger.debug(`invalid type: ${msg.type}`);
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
      });
    }

    if (hasTag(this.bot, gid, 'discord:?')) {
      getTags(this.bot, gid, 'discord:?').map(async (tag) => {
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
            msg.extra.urls.map(async (url) => {
              const inputMatch = telegramLinkRegExp.exec(url);
              if (inputMatch && inputMatch.length > 0) {
                logger.debug(`ignoring telegram url: ${url}`);
              } else {
                if (url.indexOf('instagram') > -1) {
                  url = url.split('?')[0];
                }
              }
              await sendRequest(
                webhookUrl,
                { content: url },
                {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                null,
                true,
                this.bot,
              );
            });
          } else {
            if (msg.content.startsWith('http')) {
              await sendRequest(
                webhookUrl,
                { content: msg.content },
                {
                  'Content-Type': 'application/x-www-form-urlencoded',
                },
                null,
                true,
                this.bot,
              );
            } else {
              const file = await this.bot.bindings.getFile(msg.content);
              // TODO
              if (file) {
                await sendRequest(
                  webhookUrl,
                  { content: file },
                  {
                    'Content-Type': 'multipart/form-data',
                  },
                  null,
                  true,
                  this.bot,
                );
              }
            }
          }
        }
      });
    }
  }
}
