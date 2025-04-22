import format from 'string-format';

import { PluginBase } from '../plugin';
import { delTag, getTags, getUsername, hasTag, isAdmin, isGroupAdmin, now, random, setTag } from '../utils';
import { Bot } from '../bot';
import { Message } from '../types';

export class RussianRoulettePlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/roulette',
        friendly: '^roulette$',
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
    if (await hasTag(this.bot, gid, 'noroulette')) {
      delTag(this.bot, gid, 'roulette:?');
      return;
    }
    let text;
    let bullets = null;
    const roulette = await getTags(this.bot, gid, 'roulette:?');
    if (roulette.length > 0) {
      bullets = +roulette[0].split(':')[1];
    }
    if (!bullets) {
      setTag(this.bot, gid, 'roulette:6');
      bullets = 6;
    }

    if (random(1, bullets) == 1) {
      setTag(this.bot, gid, 'roulette:6');

      if (isGroupAdmin(this.bot, uid, msg) && !isAdmin(this.bot, uid)) {
        const res = await this.bot.bindings.kickConversationMember(msg.conversation.id, uid);
        if (!res) {
          text = format(this.strings.saved, await getUsername(this.bot, uid));
        } else {
          text = format(this.strings.shot, await getUsername(this.bot, uid));
        }
      } else {
        text = format(this.strings.saved, await getUsername(this.bot, uid));
      }
    } else {
      bullets -= 1;
      setTag(this.bot, gid, `roulette:${bullets}`);
      text = format(this.strings.miss, await getUsername(this.bot, uid), bullets);
    }
    setTag(this.bot, gid, `lastroulette:${now()}`);

    this.bot.replyMessage(msg, text);
  }
}
