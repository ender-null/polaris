import format from 'string-format';
import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { getFullName, getInput, getTarget } from '../utils';

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
      currentNick: '{0}\'s nickname is "{1}"',
      noNick: '{0} currently has no nickname',
      nickSet: '{0}\'s nickname has been set to "{1}"',
      deletedNick: '{0} nickname has been deleted',
    };
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg);
    const uid = getTarget(this.bot, msg, null, true);
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
        db.usersSnap.child(uid).child('nick').ref.remove();
        text = format(this.strings.deletedNick, name);
      } else {
        if (db.users[uid] !== undefined) {
          db.users[uid].nick = input;
          db.usersSnap.child(uid).ref.update({
            nick: db.users[uid].nick,
          });
        }
        text = format(this.strings.nickSet, name, input);
      }
    }
    this.bot.replyMessage(msg, text);
  }
}
