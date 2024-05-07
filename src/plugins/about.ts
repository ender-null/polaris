import format from 'string-format';

import { db } from '../main';
import { PluginBase } from '../plugin';
import { getUsername, isCommand } from '../utils';
import { Bot } from '../bot';
import { Message } from '../types';

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
      version: 'Running <a href="https://git.io/polaris">polaris</a> <code>{0}</code> by {1}.',
      license:
        '<b>Polaris</b> (including all plugins and documentation) is <b>free software</b>; you are free to redistribute it and/or modify it under the terms of the <b>AGPL-3.0 License</b>.',
      help: 'Write {0}help to know what I can do!',
      about: 'Use {0}about to know more about me',
      donations: 'You can make {0}donations at https://revolut.me/endernull',
      stats: '👤 {0} users\n👥 {1} groups',
      donationsExplanation: 'You can make donations at https://revolut.me/endernull',
      supportersTitle: '<b>Supporters:</b>',
    };
  }
  async run(msg: Message): Promise<void> {
    let text;
    if (isCommand(this, 1, msg.content) || isCommand(this, 3, msg.content)) {
      const ownerUsername = await getUsername(this.bot, this.bot.config.owner);
      const users = db[this.bot.platform].collection('users');
      const userCount = await users.countDocuments();
      const groups = db[this.bot.platform].collection('groups');
      const groupCount = await groups.countDocuments();
      const greeting = format(this.strings.greeting, this.bot.user.firstName);
      const version = format(this.strings.version, process.env.npm_package_version, ownerUsername);
      const license = this.strings.license;
      const help = format(this.strings.help, this.bot.config.prefix);
      const about = format(this.strings.about, this.bot.config.prefix);
      const donations = format(this.strings.donations, this.bot.config.prefix);
      const stats = format(this.strings.stats, userCount, groupCount);

      if (isCommand(this, 1, msg.content)) {
        text = `${greeting}\n\n${help}\n\n${version}\n${donations}\n\n${license}\n\n${stats}`;
      } else {
        text = `${greeting}\n\n${help}\n${about}\n\n${donations}`;
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
    const groups = db[this.bot.platform].collection('groups');
    const gid = String(msg.conversation.id);
    if (gid.startsWith('-')) {
      const group = await groups.findOne({ id: gid });
      if (group) {
        if (group.title != msg.conversation.title) {
          const document = {
            id: gid,
            title: msg.conversation.title || '',
          };

          await groups.updateOne({ id: gid }, { $set: document });
        }
      } else {
        const document = {
          id: gid,
          title: msg.conversation.title || '',
        };
        await groups.insertOne(document);
      }
    }

    if (String(msg.sender.id).startsWith('-100')) {
      return;
    }
    const users = db[this.bot.platform].collection('users');
    const uid = String(msg.sender.id);
    const user = await users.findOne({ id: uid });

    if (user) {
      let doUpdate = false;
      const document = {
        id: uid,
      };
      if (user.first_name != msg.sender['firstName']) {
        document['first_name'] = msg.sender['firstName'] || '';
        doUpdate = true;
      }
      if (user.last_name != msg.sender['lastName']) {
        document['last_name'] = msg.sender['lastName'] || '';
        doUpdate = true;
      }
      if (user.username != msg.sender['username']) {
        document['username'] = msg.sender['username'] || '';
        doUpdate = true;
      }
      if (user.is_bot != msg.sender['isBot']) {
        document['is_bot'] = msg.sender['isBot'] || false;
        doUpdate = true;
      }
      if (doUpdate) {
        await users.updateOne({ id: uid }, { $set: document });
      }
    } else {
      const document = {
        id: uid,
        first_name: msg.sender['firstName'] || '',
        last_name: msg.sender['lastName'] || '',
        username: msg.sender['username'] || '',
        is_bot: msg.sender['isBot'] || false,
      };
      await users.insertOne(document);
    }

    const bid = String(this.bot.user.id);
    const myself = await users.findOne({ id: bid });
    if (myself) {
      let doUpdate = false;
      const document = {
        id: bid,
      };
      if (myself.first_name != this.bot.user.firstName) {
        document['first_name'] = this.bot.user.firstName || '';
        doUpdate = true;
      }
      if (myself.last_name != this.bot.user.lastName) {
        document['last_name'] = this.bot.user.lastName || '';
        doUpdate = true;
      }
      if (myself.username != this.bot.user.username) {
        document['username'] = this.bot.user.username || '';
        doUpdate = true;
      }
      if (myself.is_bot != this.bot.user.isBot) {
        document['is_bot'] = this.bot.user.isBot || false;
        doUpdate = true;
      }
      if (doUpdate) {
        await users.updateOne({ id: bid }, { $set: document });
      }
    } else {
      const document = {
        id: bid,
        first_name: this.bot.user.firstName || '',
        last_name: this.bot.user.lastName || '',
        username: this.bot.user.username || '',
        is_bot: this.bot.user.isBot || false,
      };
      await users.insertOne(document);
    }
  }
}
