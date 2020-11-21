import format from 'string-format';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { delTag, getTags, getUsername, hasTag, isGroupAdmin, now, random, setTag } from '../utils';

export class RussianRoulettePlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/roulette',
        description: 'Russian roulette, if you lose you will be kicked and banned',
      },
    ];
    this.strings = {
      shot: '<b>Bang!</b> {0} died in a dumb way',
      miss: '<b>You were lucky {0}!</b> <b>{1}</b> shots left.',
      saved: "<b>Bang!</b>{0} I can't kill you, but play dead, or something. ¯\\_(ツ)_/¯",
    };
  }
  async run(msg: Message): Promise<void> {
    const uid = msg.sender.id;
    const gid = msg.conversation.id;
    if (+gid > 0) {
      return this.bot.replyMessage(msg, this.bot.errors.groupOnly);
    }
    if (hasTag(this.bot, gid, 'noroulette')) {
      delTag(this.bot, gid, 'roulette:?');
      return;
    }
    let text;
    let bullets = null;
    const roulette = getTags(this.bot, gid, 'roulette:?');
    if (roulette) {
      bullets = +roulette[0].split(':')[1];
    }
    if (!bullets) {
      setTag(this.bot, gid, 'roulette:6');
      bullets = 6;
    }

    if (random(1, bullets) === 1) {
      delTag(this.bot, gid, 'roulette:?');
      setTag(this.bot, gid, 'roulette:6');

      if (isGroupAdmin(this.bot, uid, msg)) {
        const res = await this.bot.bindings.kickConversationMember(msg.conversation.id, uid);
        if (!res) {
          text = format(this.strings['saved'], getUsername(uid));
        } else {
          text = format(this.strings['shot'], getUsername(uid));
        }
      } else {
        text = format(this.strings['saved'], getUsername(uid));
      }
    } else {
      delTag(this.bot, gid, `roulette:${bullets}`);
      bullets -= 1;
      setTag(this.bot, gid, `roulette:${bullets}`);
      text = format(this.strings['miss'], getUsername(uid), bullets);
    }
    delTag(this.bot, gid, `lastroulette:?`);
    setTag(this.bot, gid, `lastroulette:${now()}`);

    this.bot.replyMessage(msg, text);
  }
}
