import format from 'string-format';
import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { DatabasePoleList, SortedPole } from '../types';
import { capitalize, getCommandIndex, getFullName, getUsername, hasTag, now, time, timeInRange } from '../utils';

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
        friendly: '^pole$|oro',
        description: 'Get the pole',
      },
      {
        command: '/subpole',
        friendly: '^subpole|plata',
        description: 'Get the subpole',
        hidden: true,
      },
      {
        command: '/fail',
        friendly: '^fail|bronce',
        description: 'Get the fail',
        hidden: true,
      },
      {
        command: '/iron',
        friendly: '(^| )hierro($| )',
        description: 'Get the iron',
        hidden: true,
      },
      {
        command: '/polecanaria',
        friendly: '(^| )pole canaria($| )',
        description: 'Get the pole canaria',
        hidden: true,
      },
      {
        command: '/poleandaluza',
        friendly: '(^| )pole andaluza($| )',
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
    const uid = String(msg.sender.id);
    const date = new Date().toISOString().split('T')[0];
    let text;
    const commandIndex = getCommandIndex(this, msg.content);
    const types = ['pole', 'subpole', 'fail', 'iron', 'canaria', 'andaluza'];

    if (commandIndex == 0) {
      if (db.poles && db.poles[gid] != undefined) {
        let rankingTypes;
        if (timeInRange(time(1), time(2), now())) {
          rankingTypes = [types[4]];
        } else if (timeInRange(time(12), time(13), now())) {
          rankingTypes = [types[5]];
        } else {
          rankingTypes = types.slice(0, 4);
        }
        const ranking: DatabasePoleList = {};
        for (const day in db.poles[gid]) {
          for (const type of rankingTypes) {
            if (db.poles[gid][day][type] != undefined) {
              if (ranking[db.poles[gid][day][type]] == undefined) {
                ranking[db.poles[gid][day][type]] = {};
                for (const t of rankingTypes) {
                  ranking[db.poles[gid][day][type]][t] = 0;
                }
              }
              ranking[db.poles[gid][day][type]][type] += 1;
            }
          }
        }
        text = `<b>${this.strings['ranking']}:</b>`;
        const rank = this.sortRanking(ranking, 'points');
        for (const i in rank) {
          text += `\n • ${getFullName(rank[i].uid, false)}: <b>${rank[i].points}</b> ${this.strings['points']}`;
        }

        for (const type of types) {
          let section = `\n\n<b>${capitalize(this.strings[type + 's'])}:</b>`;
          let empty = true;
          const rank = this.sortRanking(ranking, type);
          for (const i in rank) {
            if (rank[i][type]) {
              empty = false;
              section += `\n • ${getFullName(rank[i].uid, false)}: <b>${rank[i][type]}</b> ${this.strings[type + 's']}`;
            }
          }
          if (!empty) {
            text += section;
          }
        }
      } else {
        this.bot.replyMessage(msg, this.bot.errors.noResults);
      }
    } else if (commandIndex == 1) {
      return this.bot.replyMessage(msg, this.bot.errors.notImplemented);
    } else if (commandIndex >= 2 && commandIndex <= 7) {
      const type = types[commandIndex - 2];
      if (
        db.poles &&
        db.poles[gid] &&
        db.poles[gid][date] &&
        (((type == 'subpole' || type == 'fail' || type == 'iron') && db.poles[gid][date].pole == undefined) ||
          ((type == 'fail' || type == 'iron') && db.poles[gid][date].subpole == undefined) ||
          (type == 'iron' && db.poles[gid][date].fail == undefined))
      ) {
        return this.bot.replyMessage(msg, format(this.strings['tooSoon'], getUsername(uid)));
      }
      if (type == 'canaria' && !timeInRange(time(1), time(2), now())) {
        return this.bot.replyMessage(msg, `${capitalize(type)} not available`);
      } else if (type == 'andaluza' && !timeInRange(time(12), time(13), now())) {
        return this.bot.replyMessage(msg, format(this.strings['tooSoonAndaluza'], getUsername(uid)));
      }
      if (this.hasPole(gid, uid, date) && type != 'canaria' && type != 'andaluza') {
        return this.bot.replyMessage(msg, format('{0} has already claimed a pole', getUsername(uid)));
      }
      if (db.poles && db.poles[gid] && db.poles[gid][date] && db.poles[gid][date][type] != undefined) {
        return this.bot.replyMessage(msg, `${capitalize(type)} already claimed`);
      }

      if (!db.poles || db.poles[gid] == undefined || db.poles[gid][date] == undefined) {
        db.polesSnap
          .child(gid)
          .child(date)
          .ref.set({
            [type]: uid,
          });
      } else {
        db.polesSnap
          .child(gid)
          .child(date)
          .ref.update({
            [type]: uid,
          });
      }
      text = format(this.strings['got' + capitalize(type)], getUsername(uid));
    }
    this.bot.replyMessage(msg, text);
  }

  hasPole(gid: number | string, uid: number | string, date: string): boolean {
    if (db.poles && db.poles[gid] != undefined && db.poles[gid][date] != undefined) {
      const types = ['pole', 'subpole', 'fail', 'iron'];
      for (const type of types) {
        if (db.poles[gid][date][type] != undefined && db.poles[gid][date][type] == uid) {
          return true;
        }
      }
    }
    return false;
  }

  sortRanking(ranking: DatabasePoleList, type: string): SortedPole[] {
    const items: SortedPole[] = Object.keys(ranking).map((key) => {
      return {
        ...ranking[key],
        uid: key,
        points:
          +ranking[key].pole * 3 + +ranking[key].subpole * 1 + +ranking[key].fail * 0.5 + +ranking[key].iron * 0.1,
      };
    });
    items.sort((first, second) => {
      if (type == 'points') {
        return second.points - first.points;
      } else {
        return second[type] - first[type];
      }
    });
    return items;
  }
}
