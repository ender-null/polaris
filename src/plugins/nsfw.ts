import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { hasTag, isCommand, random } from '../utils';

export class NSFWPlugin extends PluginBase {
  invalidIds: number[];
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/nsfw',
        description: 'Send random NSFW content',
      },
      {
        command: '/hentai',
        description: 'Send random hentai content',
      },
      {
        command: '/porn',
        description: 'Send random porn content',
      },
    ];
    this.bindings = ['TelegramTDlibBindings'];
    this.invalidIds = [];
  }
  async run(msg: Message): Promise<void> {
    if (hasTag(this.bot, msg.conversation.id, 'nonsfw')) {
      this.bot.replyMessage(msg, this.bot.errors.failed);
    }
    const ids = {
      nsfw: -1001230470587,
      hentai: -1001495126561,
      porn: -1001409180171,
    };
    let cid;
    if (isCommand(this, 2, msg.content)) {
      cid = ids.hentai;
    } else if (isCommand(this, 3, msg.content)) {
      cid = ids.porn;
    } else {
      cid = ids.nsfw;
    }

    if (!this.bot.user.isBot) {
      const history = await this.bot.bindings['serverRequest']('getChatHistory', {
        chat_id: cid,
        from_message_id: 0,
        offset: 0,
        limit: 100,
      });

      if (history) {
        let message = null;
        while (!message) {
          const index = random(0, history['messages'].length - 1);
          message = await this.bot.bindings.getMessage(cid, history['messages'][index]['id']);
        }
        await this.bot.forwardMessage(message, msg.conversation.id);
      }
    } else {
      const info = await this.bot.bindings.conversationInfo(cid);

      if (info) {
        let message = null;
        const last = info['last_message']['id'];
        const start = 1;
        let retries = 100;

        while (!message) {
          let rid = random(start, last);
          while (rid in this.invalidIds) rid = random(start, last);
          message = await this.bot.bindings.getMessage(cid, rid);
          if (!message && this.invalidIds.indexOf(rid) == -1) {
            retries -= 1;
            this.invalidIds.push(rid);
          }

          if (retries <= 0) {
            message = await this.bot.bindings.getMessage(cid, last);
          }
        }
        return await this.bot.forwardMessage(message, msg.conversation.id);
      }
    }
  }
}
