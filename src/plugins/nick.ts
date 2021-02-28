import format from 'string-format';
import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getFullName, getInput, getTarget } from '../utils';

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
      nickSet: '{0}\'s nickname has been set to "{1}"',
    };
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    const uid = getTarget(this.bot, msg, input);
    const name = getFullName(uid, false);
    if (db.users[uid] !== undefined) {
      db.users[uid].nick = input;
      db.usersSnap.child(uid).ref.update({
        nick: db.users[uid].nick,
      });
    }
    const text = format(this.strings.nickSet, name, input);
    this.bot.replyMessage(msg, text);
  }
}
