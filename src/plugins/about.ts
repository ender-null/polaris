import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { catchException, execResult, isCommand } from '../utils';

export class AboutPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/about',
        description: 'Info about the bot',
      },
      {
        command: '/donations',
        description: 'Some help is always good',
        keepDefault: true,
      },
      {
        command: '/start',
        keepDefault: true,
        hidden: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    let text;
    if (isCommand(this, 1, msg.content) || isCommand(this, 3, msg.content)) {
      let tag = 'latest';
      try {
        tag = await execResult('git rev-parse --short HEAD');
      } catch (e) {
        catchException(e, this.bot);
      }
      const greeting = `Hi! I'm <b>${this.bot.user.firstName}</b>!\nNice to meet you.`;
      const version = `Running <a href="https://git.io/polaris.js">polaris.js</a> <code>${tag}</code> by @endernull.`;
      const license = `<b>Polaris.js</b> (including all plugins and documentation) is <b>free software</b>; you are free to redistribute it and/or modify it under the terms of the <b>GNU AGPLv3</b>.`;
      const help = `Write ${this.bot.config.prefix}help to know what I can do!`;
      const about = `Use ${this.bot.config.prefix}about to know more about me`;
      const notice = `You can try my other bots: <a href="https://t.me/sakubo">@Sakubo</a> and <a href="https://t.me/PetoBot">@PetoBot</a>`;
      const donations = `You can make donations at https://paypal.me/luksireiku`;
      const stats = `👤 ${Object.keys(db.users).length} users\n👥 ${Object.keys(db.groups).length} groups`;

      if (isCommand(this, 1, msg.content)) {
        text = `${greeting}\n\n${notice}\n\n${help}\n${about}\n\n${version}\n${donations}\n\n${license}\n\n${stats}`;
      } else {
        text = `${greeting}\n\n${notice}\n\n${help}\n${about}\n\n${donations}`;
      }
    } else if (isCommand(this, 2, msg.content)) {
      const donationsExplanation = `You can make donations at https://paypal.me/luksireiku`;
      const supportersTitle = `<b>Supporters:</b>`;
      const supporters = '';
      if (supporters.length > 0) {
        text = `${donationsExplanation}\n\n${supportersTitle}${supporters}`;
      } else {
        text = donationsExplanation;
      }
    }
    this.bot.replyMessage(msg, text, 'text', null, { format: 'HTML', preview: false });
  }

  async always(msg: Message): Promise<void> {
    // Update group data
    const gid = String(msg.conversation.id);
    if (+msg.conversation.id < 0) {
      if (gid in Object.keys(db.groups)) {
        db.groupsSnap.child(gid).ref.update({
          title: msg.conversation.title,
        });
      } else {
        db.groupsSnap.child(gid).ref.set({
          title: msg.conversation.title,
        });
      }
    }

    const uid = String(msg.sender.id);
    if (uid.startsWith('-100')) {
      return;
    }

    if (uid in Object.keys(db.users)) {
      db.usersSnap.child(uid).ref.update({
        first_name: msg.sender['firstName'],
        last_name: msg.sender['lastName'],
        username: msg.sender['username'],
        is_bot: msg.sender['isBot'],
      });
    } else {
      db.usersSnap.child(uid).ref.set({
        first_name: msg.sender['firstName'],
        last_name: msg.sender['lastName'],
        username: msg.sender['username'],
        is_bot: msg.sender['isBot'],
      });
    }
  }
}
