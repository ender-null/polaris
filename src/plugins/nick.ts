import { remove, update } from 'firebase/database';
import format from 'string-format';
import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { getFullName, getInput, getTarget, isTrusted } from '../utils';

export class NickPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/nick',
        parameters: [
          {
            name: 'name',
            required: true,
          },
        ],
        description: 'Sets your nickname',
      },
    ];
    this.strings = {
      currentNick: '<b>{0}</b>\'s nickname is "<i>{1}</i>"',
      noNick: '<b>{0}</b> currently has no nickname',
      nickSet: '<b>{0}</b>\'s nickname has been set to "<i>{1}</i>"',
      deletedNick: '<b>{0}</b> nickname has been deleted',
    };
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg);
    const uid = getTarget(this.bot, msg, null, true);
    if (uid != String(msg.sender.id) && !isTrusted(this.bot, msg.sender.id, msg)) {
      return this.bot.replyMessage(msg, this.bot.errors.permissionRequired);
    }
    const name = getFullName(uid, false, false);
    let text;
    if (!input) {
      if (db.users[uid] !== undefined && db.users[uid].nick) {
        text = format(this.strings.currentNick, name, db.users[uid].nick);
      } else {
        text = format(this.strings.noNick, name);
      }
    } else {
      if (input == '--') {
        delete db.users[uid].nick;
        remove(db.usersSnap.child(uid).child('nick').ref);
        text = format(this.strings.deletedNick, name);
      } else {
        if (db.users[uid] !== undefined) {
          db.users[uid].nick = input;
          update(db.usersSnap.child(uid).ref, {
            nick: db.users[uid].nick,
          });
        }
        text = format(this.strings.nickSet, name, input);
      }
    }
    this.bot.replyMessage(msg, text);
  }
}
