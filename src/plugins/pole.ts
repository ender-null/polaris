import format from 'string-format';

import { db } from '../main';
import { PluginBase } from '../plugin';
import { DatabasePoleList, Message, SortedPole } from '../types';
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
import { Bot } from '../bot';

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
        friendly: '^pole$|oro',
        description: 'Get the pole',
        skipHelp: true,
        alwaysEnabled: true,
      },
      {
        command: '/subpole',
        friendly: '^subpole|plata',
        description: 'Get the subpole',
        hidden: true,
        skipHelp: true,
        alwaysEnabled: true,
      },
      {
        command: '/fail',
        friendly: '^fail|bronce',
        description: 'Get the fail',
        hidden: true,
        skipHelp: true,
        alwaysEnabled: true,
      },
      {
        command: '/iron',
        friendly: '(^| )hierro($| )',
        description: 'Get the iron',
        hidden: true,
        skipHelp: true,
        alwaysEnabled: true,
      },
      {
        command: '/polecanaria',
        friendly: '(^| )pole canaria($| )',
        description: 'Get the pole canaria',
        hidden: true,
        skipHelp: true,
        alwaysEnabled: true,
      },
      {
        command: '/poleandaluza',
        friendly: '(^| )pole andaluza($| )',
        description: 'Get the pole andaluza',
        hidden: true,
        skipHelp: true,
        alwaysEnabled: true,
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
    if (!String(msg.conversation.id).startsWith('-')) {
      return this.bot.replyMessage(msg, this.bot.errors.groupOnly);
    }
    if (await hasTag(this.bot, msg.conversation.id, 'nopole')) {
      return;
    }

    const gid = String(msg.conversation.id);
    const uid = String(msg.sender.id);
    const dateObject = new Date();
    const date = `${dateObject.getFullYear()}-${dateObject.getMonth()}-${dateObject.getDate()}`;
    let text;
    const commandIndex = getCommandIndex(this, msg.content);
    const types = ['pole', 'subpole', 'fail', 'iron', 'canaria', 'andaluza'];

    const poles = db[this.bot.platform].collection('poles');
    if (commandIndex == 0) {
      const groupPoles = await poles.find({ gid }).toArray();
      if (groupPoles?.length) {
        let rankingTypes;
        if (timeInRange(time(1), time(2), now())) {
          rankingTypes = [types[4]];
        } else if (timeInRange(time(12), time(13), now())) {
          rankingTypes = [types[5]];
        } else {
          rankingTypes = types.slice(0, 4);
        }
        const ranking: DatabasePoleList = {};
        groupPoles.forEach((entry) => {
          rankingTypes.map((type) => {
            if (entry[type] != undefined) {
              if (ranking[entry[type]] == undefined) {
                ranking[entry[type]] = {};
                rankingTypes.map((t) => {
                  ranking[entry[type]][t] = 0;
                });
              }
              ranking[entry[type]][type] += 1;
            }
          });
        });
        text = `<b>${this.strings.ranking}:</b>`;
        const rank = this.sortRanking(ranking, 'points');
        rank.map(async (user) => {
          text += `\n • ${await getFullName(this.bot, user.uid, false)}: <b>${user.points}</b> ${this.strings.points}`;
        });

        types.map((type) => {
          let section = `\n\n<b>${capitalize(this.strings[type + 's'])}:</b>`;
          let empty = true;
          const rank = this.sortRanking(ranking, type);
          rank.map(async (user) => {
            if (user[type]) {
              empty = false;
              section += `\n • ${await getFullName(this.bot, user.uid, false)}: <b>${user[type]}</b> ${this.strings[type + 's']}`;
            }
          });
          if (!empty) {
            text += section;
          }
        });
      } else {
        this.bot.replyMessage(msg, this.bot.errors.noResults);
      }
    } else if (commandIndex == 1) {
      if (await hasTag(this.bot, msg.conversation.id, 'polereset')) {
        if (isTrusted(this.bot, msg.sender.id, msg) || isAdmin(this.bot, msg.sender.id)) {
          text = this.strings.polereset;
          await poles.deleteMany({ gid });
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
      const todaysPoles = await poles.findOne({ gid, date: date });
      if (todaysPoles) {
        typesToShow.map(async (type) => {
          if (todaysPoles[type] != undefined) {
            text += `\n${format(this.strings[type + 'Set'], await getFullName(this.bot, todaysPoles[type], false))}`;
          } else {
            text += `\n${this.strings[type + 'NotSet']}`;
          }
        });
      } else {
        text += `\n${this.strings.poleNotSet}`;
      }
      return this.bot.replyMessage(msg, text);
    } else if (commandIndex >= 3 && commandIndex <= 8) {
      const type = types[commandIndex - 3];
      const todaysPoles = await poles.findOne({ gid, date: date });
      if (todaysPoles) {
        if (
          ((type == 'subpole' || type == 'fail' || type == 'iron') && !todaysPoles.pole) ||
          ((type == 'fail' || type == 'iron') && !todaysPoles.subpole) ||
          (type == 'iron' && !todaysPoles.fail)
        ) {
          return this.bot.replyMessage(msg, format(this.strings.tooSoon, await getUsername(this.bot, uid)));
        }
      }
      if (type == 'canaria' && !timeInRange(time(1), time(2), now())) {
        return this.bot.replyMessage(msg, format(this.strings.tooSoonCanaria, await getUsername(this.bot, uid)));
      } else if (type == 'andaluza' && !timeInRange(time(12), time(13), now())) {
        return this.bot.replyMessage(msg, format(this.strings.tooSoonAndaluza, await getUsername(this.bot, uid)));
      }
      if ((await this.hasPole(gid, uid, date)) && type != 'canaria' && type != 'andaluza') {
        return;
      }
      if (todaysPoles && todaysPoles[type] != undefined) {
        return;
      }

      if (!todaysPoles) {
        await poles.insertOne({
          gid,
          date: date,
          [type]: uid,
        });
      } else {
        poles.updateOne(
          { gid, date: date },
          {
            $set: {
              [type]: uid,
            },
          },
        );
      }
      text = format(this.strings['got' + capitalize(type)], await getUsername(this.bot, uid));
    }
    this.bot.replyMessage(msg, text);
  }

  async hasPole(gid: number | string, uid: number | string, date: string): Promise<boolean> {
    const poles = db[this.bot.platform].collection('poles');
    const todaysPoles = await poles.findOne({ gid, date: date });
    if (todaysPoles != undefined) {
      const types = ['pole', 'subpole', 'fail', 'iron'];
      for (const type of types) {
        if (todaysPoles[type] != undefined && todaysPoles[type] == uid) {
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
