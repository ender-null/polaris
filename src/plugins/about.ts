import { set, update } from 'firebase/database';
import format from 'string-format';
import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { isCommand } from '../utils';

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
      version: 'Running <a href="https://git.io/polaris">polaris</a> <code>{0}</code> by @endernull.',
      license:
        '<b>Polaris</b> (including all plugins and documentation) is <b>free software</b>; you are free to redistribute it and/or modify it under the terms of the <b>AGPL-3.0 License</b>.',
      help: 'Write {0}help to know what I can do!',
      about: 'Use {0}about to know more about me',
      channel: 'Support & suggestions at <a href="https://t.me/PolarisSupport">@PolarisSupport</a>',
      notice:
        'You can try my other bots: <a href="https://t.me/Sakubo">@Sakubo</a> and <a href="https://t.me/PetoBot">@PetoBot</a>',
      donations: 'You can make {0}donations at https://revolut.me/endernull',
      stats: '👤 {0} users\n👥 {1} groups',
      donationsExplanation: 'You can make donations at https://revolut.me/endernull',
      supportersTitle: '<b>Supporters:</b>',
    };
  }
  async run(msg: Message): Promise<void> {
    let text;
    if (isCommand(this, 1, msg.content) || isCommand(this, 3, msg.content)) {
      const greeting = format(this.strings.greeting, this.bot.user.firstName);
      const version = format(this.strings.version, process.env.npm_package_version);
      const license = this.strings.license;
      const help = format(this.strings.help, this.bot.config.prefix);
      const about = format(this.strings.about, this.bot.config.prefix);
      const notice = this.strings.notice;
      const channel = this.strings.channel;
      const donations = format(this.strings.donations, this.bot.config.prefix);
      const stats = format(this.strings.stats, Object.keys(db.users).length, Object.keys(db.groups).length);

      if (isCommand(this, 1, msg.content)) {
        text = `${greeting}\n\n${notice}\n${channel}\n\n${help}\n\n${version}\n${donations}\n\n${license}\n\n${stats}`;
      } else {
        text = `${greeting}\n\n${notice}\n${channel}\n\n${help}\n${about}\n\n${donations}`;
      }
    } else if (isCommand(this, 2, msg.content)) {
      const donationsExplanation = this.strings.donationsExplanation;
      const supportersTitle = this.strings.supportersTitle;
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
    if (String(msg.conversation.id).startsWith('-')) {
      if (!db.groups) {
        db.groups = {};
      }
      if (db.groups && db.groups[gid] != undefined) {
        let doUpdate = false;
        if (db.groups[gid].title != msg.conversation.title) {
          db.groups[gid].title = msg.conversation.title || '';
          doUpdate = true;
        }
        if (doUpdate) {
          update(db.groupsSnap.child(gid).ref, db.groups[gid]);
        }
      } else {
        db.groups[gid] = {
          title: msg.conversation.title || '',
        };
        set(db.groupsSnap.child(gid).ref, db.groups[gid]);
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
      let doUpdate = false;
      if (db.users[uid].first_name != msg.sender['firstName']) {
        db.users[uid].first_name = msg.sender['firstName'] || '';
        doUpdate = true;
      }
      if (db.users[uid].last_name != msg.sender['lastName']) {
        db.users[uid].last_name = msg.sender['lastName'] || '';
        doUpdate = true;
      }
      if (db.users[uid].username != msg.sender['username']) {
        db.users[uid].username = msg.sender['username'] || '';
        doUpdate = true;
      }
      if (db.users[uid].is_bot != msg.sender['isBot']) {
        db.users[uid].is_bot = msg.sender['isBot'] || false;
        doUpdate = true;
      }
      if (doUpdate) {
        update(db.usersSnap.child(uid).ref, db.users[uid]);
      }
    } else {
      db.users[uid] = {
        first_name: msg.sender['firstName'] || '',
        last_name: msg.sender['lastName'] || '',
        username: msg.sender['username'] || '',
        is_bot: msg.sender['isBot'] || false,
      };
      set(db.usersSnap.child(uid).ref, db.users[uid]);
    }
  }
}
