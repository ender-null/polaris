import format from 'string-format';
import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { DatabasePoleList, SortedPole } from '../types';
import {
  capitalize,
  getCommandIndex,
  getFullName,
  getUsername,
  hasTag,
  isAdmin,
  isTrusted,
  now,
  time,
  timeInRange,
} from '../utils';

export class PolePlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/polerank',
        description: 'Get the pole ranking',
        skipHelp: true,
      },
      {
        command: '/polereset',
        description: 'Reset the pole ranking',
        skipHelp: true,
      },
      {
        command: '/poles',
        description: 'Check the pole status',
        skipHelp: true,
      },
      {
        command: '/pole',
        friendly: '^pole$|oro|m[a|á]stil',
        description: 'Get the pole',
        skipHelp: true,
      },
      {
        command: '/subpole',
        friendly: '^subpole|plata',
        description: 'Get the subpole',
        hidden: true,
        skipHelp: true,
      },
      {
        command: '/fail',
        friendly: '^fail|bronce',
        description: 'Get the fail',
        hidden: true,
        skipHelp: true,
      },
      {
        command: '/iron',
        friendly: '(^| )hierro($| )',
        description: 'Get the iron',
        hidden: true,
        skipHelp: true,
      },
      {
        command: '/polecanaria',
        friendly: '(^| )pole canaria($| )',
        description: 'Get the pole canaria',
        hidden: true,
        skipHelp: true,
      },
      {
        command: '/poleandaluza',
        friendly: '(^| )pole andaluza($| )',
        description: 'Get the pole andaluza',
        hidden: true,
        skipHelp: true,
      },
    ];
    this.strings = {
      pole: 'the pole',
      subpole: 'the subpole',
      fail: 'the fail',
      iron: 'the iron',
      canaria: 'the pole canaria',
      andaluza: 'the pole andaluza',
      gold: 'the gold',
      silver: 'the silver',
      bronze: 'the bronze',
      mastil: 'the mastil',
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
      today: 'Today',
      poleSet: 'The user <b>{0}</b> got the pole',
      subpoleSet: 'The user <b>{0}</b> got the subpole',
      failSet: 'The user <b>{0}</b> got the fail',
      ironSet: 'The user <b>{0}</b> got the iron',
      canariaSet: 'The user <b>{0}</b> got the pole canaria',
      andaluzaSet: 'The user <b>{0}</b> got the pole andaluza',
      poleNotSet: 'No one got the pole yet',
      subpoleNotSet: 'No one got the subpole yet',
      failNotSet: 'No one got the fail yet',
      ironNotSet: 'No one got the iron yet',
      canariaNotSet: 'No one got the pole canaria yet',
      andaluzaNotSet: 'No one got the pole andaluza yet',
      ranking: 'Ranking',
      points: 'points',
      polereset: 'The pole ranking has been reset',
      tooSoon: 'Too soon, {0}',
      tooSoonCanaria: 'Too soon, {0} muyayo',
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
    const dateObject = new Date();
    const date = `${dateObject.getFullYear()}-${dateObject.getMonth()}-${dateObject.getDate()}`;
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
        text = `<b>${this.strings.ranking}:</b>`;
        const rank = this.sortRanking(ranking, 'points');
        for (const i in rank) {
          text += `\n • ${getFullName(rank[i].uid, false)}: <b>${rank[i].points}</b> ${this.strings.points}`;
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
      if (hasTag(this.bot, msg.conversation.id, 'polereset')) {
        if (isTrusted(this.bot, msg.sender.id, msg) || isAdmin(this.bot, msg.sender.id)) {
          text = this.strings.polereset;
          delete db.poles[gid];
          db.polesSnap.child(gid).ref.remove();
        } else {
          text = this.bot.errors.adminRequired;
        }
      } else {
        text = this.bot.errors.disabled;
      }
      return this.bot.replyMessage(msg, text);
    } else if (commandIndex == 2) {
      let text = `${this.strings.today} <b>${date}</b>`;
      let typesToShow;
      if (timeInRange(time(1), time(2), now())) {
        typesToShow = [types[4]];
      } else if (timeInRange(time(12), time(13), now())) {
        typesToShow = [types[5]];
      } else {
        typesToShow = types.slice(0, 4);
      }
      if (db.poles && db.poles[gid] && db.poles[gid][date]) {
        for (const type of typesToShow) {
          if (db.poles[gid][date][type] != undefined) {
            text += `\n${format(this.strings[type + 'Set'], getFullName(db.poles[gid][date][type], false))}`;
          } else {
            text += `\n${this.strings[type + 'NotSet']}`;
          }
        }
      } else {
        text += `\n${this.strings.poleNotSet}`;
      }
      return this.bot.replyMessage(msg, text);
    } else if (commandIndex >= 3 && commandIndex <= 8) {
      const type = types[commandIndex - 3];
      if (db.poles && db.poles[gid] && db.poles[gid][date]) {
        if (
          ((type == 'subpole' || type == 'fail' || type == 'iron') && db.poles[gid][date].pole == undefined) ||
          ((type == 'fail' || type == 'iron') && db.poles[gid][date].subpole == undefined) ||
          (type == 'iron' && db.poles[gid][date].fail == undefined)
        ) {
          return this.bot.replyMessage(msg, format(this.strings.tooSoon, getUsername(uid)));
        }
      }
      if (type == 'canaria' && !timeInRange(time(1), time(2), now())) {
        return this.bot.replyMessage(msg, format(this.strings.tooSoonCanaria, getUsername(uid)));
      } else if (type == 'andaluza' && !timeInRange(time(12), time(13), now())) {
        return this.bot.replyMessage(msg, format(this.strings.tooSoonAndaluza, getUsername(uid)));
      }
      if (this.hasPole(gid, uid, date) && type != 'canaria' && type != 'andaluza') {
        return;
      }
      if (db.poles && db.poles[gid] && db.poles[gid][date] && db.poles[gid][date][type] != undefined) {
        return;
      }

      if (!db.poles) {
        db.poles = {};
      }
      if (db.poles[gid] == undefined) {
        db.poles[gid] = {};
      }

      if (!db.poles || !db.poles[gid] || !db.poles[gid][date]) {
        db.polesSnap
          .child(gid)
          .child(date)
          .ref.set({
            [type]: uid,
          });
        db.poles[gid][date] = {
          [type]: uid,
        };
      } else {
        db.polesSnap
          .child(gid)
          .child(date)
          .ref.update({
            [type]: uid,
          });
        db.poles[gid][date][type] = uid;
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
