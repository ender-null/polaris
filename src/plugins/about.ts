import format from 'string-format';
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
    this.strings = {
      greeting: "Hi! I'm <b>{0}</b>!\nNice to meet you.",
      version: 'Running <a href="https://git.io/polaris.js">polaris.js</a> <code>{0}</code> by @endernull.',
      license:
        '<b>Polaris.js</b> (including all plugins and documentation) is <b>free software</b>; you are free to redistribute it and/or modify it under the terms of the <b>MIT</b>.',
      help: 'Write {0}help to know what I can do!',
      about: 'Use {0}about to know more about me',
      channel: 'Support & suggestions at <a href="https://t.me/PolarisSupport">@PolarisSupport</a>',
      notice:
        'You can try my other bots: <a href="https://t.me/sakubo">@Sakubo</a> and <a href="https://t.me/PetoBot">@PetoBot</a>',
      donations: 'You can make {0}donations at https://paypal.me/luksireiku',
      stats: '👤 {0} users\n👥 {1} groups',
      donationsExplanation: 'You can make donations at https://paypal.me/luksireiku',
      supportersTitle: '<b>Supporters:</b>',
    };
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
      const greeting = format(this.strings['greeting'], this.bot.user.firstName);
      const version = format(this.strings['version'], tag);
      const license = this.strings['license'];
      const help = format(this.strings['help'], this.bot.config.prefix);
      const about = format(this.strings['about'], this.bot.config.prefix);
      const notice = this.strings['notice'];
      const channel = this.strings['channel'];
      const donations = format(this.strings['donations'], this.bot.config.prefix);
      const stats = format(this.strings['stats'], Object.keys(db.users).length, Object.keys(db.groups).length);

      if (isCommand(this, 1, msg.content)) {
        text = `${greeting}\n\n${notice}\n${channel}\n\n${help}\n${about}\n\n${version}\n${donations}\n\n${license}\n\n${stats}`;
      } else {
        text = `${greeting}\n\n${notice}\n${channel}\n\n${help}\n${about}\n\n${donations}`;
      }
    } else if (isCommand(this, 2, msg.content)) {
      const donationsExplanation = this.strings['donationsExplanation'];
      const supportersTitle = this.strings['supportersTitle'];
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
      if (!db.groups) {
        db.groups = {};
      }
      if (db.groups && db.groups[gid] != undefined) {
        db.groupsSnap.child(gid).ref.update({
          title: msg.conversation.title || '',
        });
        db.groups[gid]['title'] = msg.conversation.title || '';
      } else {
        db.groupsSnap.child(gid).ref.set({
          title: msg.conversation.title || '',
        });
        db.groups[gid] = {
          title: msg.conversation.title || '',
        };
      }
    }

    const uid = String(msg.sender.id);
    if (uid.startsWith('-100')) {
      return;
    }

    if (!db.users) {
      db.users = {};
    }
    if (db.users[uid] != undefined) {
      db.usersSnap.child(uid).ref.update({
        first_name: msg.sender['firstName'] || '',
        last_name: msg.sender['lastName'] || '',
        username: msg.sender['username'] || '',
        is_bot: msg.sender['isBot'] || false,
      });
      db.users[uid]['first_name'] = msg.sender['firstName'] || '';
      db.users[uid]['last_name'] = msg.sender['lastName'] || '';
      db.users[uid]['username'] = msg.sender['username'] || '';
      db.users[uid]['is_bot'] = msg.sender['isBot'] || false;
    } else {
      db.usersSnap.child(uid).ref.set({
        first_name: msg.sender['firstName'] || '',
        last_name: msg.sender['lastName'] || '',
        username: msg.sender['username'] || '',
        is_bot: msg.sender['isBot'] || false,
      });
      db.users[uid] = {
        first_name: msg.sender['firstName'] || '',
        last_name: msg.sender['lastName'] || '',
        username: msg.sender['username'] || '',
        is_bot: msg.sender['isBot'] || false,
      };
    }
  }
}
