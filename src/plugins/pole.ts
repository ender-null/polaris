import format from 'string-format';
import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { DatabasePoleList, OrderedPole } from '../types';
import { capitalize, getFullName, getUsername, hasTag, isCommand, now, time, timeInRange } from '../utils';

export class PolePlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/polerank',
        description: 'Get the pole ranking',
      },
      {
        command: '/polereset',
        description: 'Reset the pole ranking',
      },
      {
        command: '/pole',
        friendly: 'pole',
        description: 'Get the pole',
      },
      {
        command: '/subpole',
        friendly: 'subpole',
        description: 'Get the subpole',
        hidden: true,
      },
      {
        command: '/fail',
        friendly: 'fail',
        description: 'Get the fail',
        hidden: true,
      },
      {
        command: '/iron',
        friendly: 'iron',
        description: 'Get the iron',
        hidden: true,
      },
      {
        command: '/polecanaria',
        description: 'Get the pole canaria',
        hidden: true,
      },
      {
        command: '/poleandaluza',
        description: 'Get the pole andaluza',
        hidden: true,
      },
    ];
    this.strings = {
      gotPole: '{0} got the pole',
      gotSubpole: '{0} got the subpole',
      gotFail: '{0} got the fail',
      gotIron: '{0} got the iron',
      gotCanaria: '{0} got the pole canaria',
      gotAndaluza: '{0} got the pole andaluza',
      poles: 'poles',
      subpoles: 'subpoles',
      fails: 'fails',
      irons: 'irons',
      canarias: 'poles canarias',
      andaluzas: 'poles andaluzas',
      ranking: 'Ranking',
      points: 'points',
      polereset: 'The pole ranking has been reset',
      tooSoon: 'Too soon, {0}',
      tooSoonAndaluza: 'Too soon, {0} miarma',
    };
  }
  async run(msg: Message): Promise<void> {
    if (String(msg.sender.id).startsWith('-100')) {
      return;
    }
    if (msg.conversation.id > 0) {
      return this.bot.replyMessage(msg, this.bot.errors.groupOnly);
    }
    if (hasTag(this.bot, msg.conversation.id, 'nopole')) {
      return;
    }

    const gid = String(msg.conversation.id);
    const uid = msg.sender.id;
    const date = new Date().toISOString().split('T')[0];
    let text;
    let type = 0;
    if (timeInRange(time(1), time(2), now())) {
      type = 1;
    } else if (timeInRange(time(12), time(13), now())) {
      type = 2;
    }
    if (isCommand(this, 1, msg.content)) {
      if (db.poles && db.poles[gid] != undefined) {
        let included = ['pole', 'subpole', 'fail', 'iron'];
        if (type == 1) {
          included = ['canaria'];
        } else if (type == 2) {
          included = ['andaluza'];
        }
        const ranking: DatabasePoleList = {};
        for (const day in db.poles[gid]) {
          for (const value of included) {
            if (db.poles[gid][day][value] != undefined) {
              if (ranking[db.poles[gid][day][value]] == undefined) {
                ranking[db.poles[gid][day][value]] = {};
                for (const v of included) {
                  ranking[db.poles[gid][day][value]][v] = 0;
                }
              }
              ranking[db.poles[gid][day][value]][value] += 1;
            }
          }
        }
        text = `<b>${this.strings['ranking']}:</b>`;
        const ord = this.orderBy(ranking, 'points');
        for (const i in ord) {
          text += `\n • ${getFullName(ord[i].uid, false)}: <b>${ord[i].points}</b> ${this.strings['points']}`;
        }

        for (const value of included) {
          let section = `\n\n<b>${capitalize(this.strings[value + 's'])}:</b>`;
          let empty = true;
          const ord = this.orderBy(ranking, value);
          for (const i in ord) {
            if (ord[i][value]) {
              empty = false;
              section += `\n • ${getFullName(ord[i].uid, false)}: <b>${ord[i][value]}</b> ${this.strings[value + 's']}`;
            }
          }
          if (!empty) {
            text += section;
          }
        }
      } else {
        this.bot.replyMessage(msg, this.bot.errors.noResults);
      }
    } else if (isCommand(this, 2, msg.content)) {
      return this.bot.replyMessage(msg, this.bot.errors.notImplemented);
    } else if (
      isCommand(this, 3, msg.content) ||
      isCommand(this, 4, msg.content) ||
      isCommand(this, 5, msg.content) ||
      isCommand(this, 6, msg.content)
    ) {
      if (this.hasPole(gid, uid, date, type)) {
        return;
      }
      let value = 'pole';
      if (isCommand(this, 4, msg.content)) {
        value = 'subpole';
      } else if (isCommand(this, 5, msg.content)) {
        value = 'fail';
      } else if (isCommand(this, 6, msg.content)) {
        value = 'iron';
      }

      if (
        ((value == 'subpole' || value == 'fail' || value == 'iron') && db.poles[gid][date].pole == undefined) ||
        ((value == 'fail' || value == 'iron') && db.poles[gid][date].subpole == undefined) ||
        (value == 'iron' && db.poles[gid][date].fail == undefined)
      ) {
        return this.bot.replyMessage(msg, format(this.strings['tooSoon'], getUsername(uid)));
      }
      if (db.poles && db.poles[gid] && db.poles[gid][date] && db.poles[gid][date][value] != undefined) {
        return;
      }

      if (!db.poles || db.poles[gid] == undefined || db.poles[gid][date] == undefined) {
        db.polesSnap
          .child(gid)
          .child(date)
          .ref.set({
            [value]: uid,
          });
      } else {
        db.polesSnap
          .child(gid)
          .child(date)
          .ref.update({
            [value]: uid,
          });
      }
      text = format(this.strings['got' + capitalize(value)], getUsername(uid));
    }
    this.bot.replyMessage(msg, text);
  }

  hasPole(gid: number | string, uid: number | string, date: string, type?: number): boolean {
    if (db.poles && db.poles[gid] != undefined && db.poles[gid][date] != undefined) {
      let included = ['pole', 'subpole', 'fail', 'iron'];
      if (type == 1) {
        included = ['canaria'];
      } else if (type == 2) {
        included = ['andaluza'];
      }
      for (const value of included) {
        if (db.poles[gid][date][value] != undefined && db.poles[gid][date][value] == uid) {
          return true;
        }
      }
    }
    return false;
  }

  orderBy(ranking: DatabasePoleList, value: string): OrderedPole[] {
    const items: OrderedPole[] = Object.keys(ranking).map((key) => {
      return {
        ...ranking[key],
        uid: key,
        points:
          +ranking[key].pole * 3 + +ranking[key].subpole * 1 + +ranking[key].fail * 0.5 + +ranking[key].iron * 0.1,
      };
    });
    items.sort((first, second) => {
      if (value == 'points') {
        return second.points - first.points;
      } else {
        return second[value] - first[value];
      }
    });
    return items;
  }
}
