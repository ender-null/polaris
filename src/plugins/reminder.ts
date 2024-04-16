import format from 'string-format';
import { Bot, Conversation, DatabaseReminder, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import {
  allButNWord,
  catchException,
  generateCommandHelp,
  getFullName,
  getInput,
  getUsername,
  getWord,
  isInt,
  now,
} from '../utils';

export class ReminderPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/remindme',
        aliases: ['/rm'],
        parameters: [
          {
            name: 'delay',
            required: true,
          },
          {
            name: 'unit',
            required: true,
          },
          {
            name: 'text',
            required: true,
          },
        ],
        description: 'Remind you things after a delay.',
      },
    ];
    this.strings = {
      second: 'second',
      seconds: 'seconds',
      minute: 'minute',
      minutes: 'minutes',
      hour: 'hour',
      hours: 'hours',
      day: 'day',
      days: 'days',
      message: "<b>{0}</b>, I'll remind you in <b>{1}</b> to <i>{2}</i>.",
      noReminder: '',
      wrongDelay: '',
    };
    this.cronExpression = '*/10 * * * * *';
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content), 'text', null, { format: 'HTML' });
    }

    if (msg.sender.constructor.name == 'Conversation') {
      return;
    }

    const delay = getWord(input, 1);
    const unit = getWord(input, 2);
    const text = allButNWord(input, 2);
    const alarm = this.generateAlarm(delay, unit);

    if (!text) {
      return this.bot.replyMessage(msg, this.strings.noReminder);
    }

    if (!isInt(delay)) {
      return this.bot.replyMessage(msg, this.strings.wrongDelay);
    }

    const reminder: DatabaseReminder = {
      bot: this.bot.user.id,
      alarm: alarm,
      chatId: msg.conversation.id,
      userId: msg.sender.id,
      text: text,
    };
    if (msg.sender['username'] && msg.sender['username'].length > 0) {
      reminder.username = msg.sender['username'];
    }
    try {
      let delayText = delay;
      if (
        unit == this.strings.second ||
        unit == this.strings.seconds ||
        unit == 's' ||
        unit == 'sec' ||
        unit == 'secs' ||
        unit == 'second' ||
        unit == 'seconds'
      ) {
        if (+delay > 1) {
          delayText = `${delay} ${this.strings.seconds}`;
        } else {
          delayText = `${delay} ${this.strings.second}`;
        }
      } else if (
        unit == this.strings.minute ||
        unit == this.strings.minutes ||
        unit == 'm' ||
        unit == 'min' ||
        unit == 'mins' ||
        unit == 'minute' ||
        unit == 'minutes'
      ) {
        if (+delay > 1) {
          delayText = `${delay} ${this.strings.minutes}`;
        } else {
          delayText = `${delay} ${this.strings.minute}`;
        }
      } else if (
        unit == this.strings.hour ||
        unit == this.strings.hours ||
        unit == 'h' ||
        unit == 'hour' ||
        unit == 'hours'
      ) {
        if (+delay > 1) {
          delayText = `${delay} ${this.strings.hours}`;
        } else {
          delayText = `${delay} ${this.strings.hour}`;
        }
      } else if (
        unit == this.strings.day ||
        unit == this.strings.days ||
        unit == 'd' ||
        unit == 'day' ||
        unit == 'days'
      ) {
        if (+delay > 1) {
          delayText = `${delay} ${this.strings.days}`;
        } else {
          delayText = `${delay} ${this.strings.day}`;
        }
      } else {
        return this.bot.replyMessage(msg, this.bot.errors.invalidArgument);
      }
      const reminders = db[this.bot.platform].collection('reminders');
      reminders.insertOne(reminder);

      const message = format(
        this.strings['message'],
        await getFullName(this.bot, msg.sender.id, false),
        delayText,
        text,
      );
      this.bot.replyMessage(msg, message);
    } catch (e) {
      catchException(e, this.bot);
      this.bot.replyMessage(msg, this.bot.errors.exceptionFound);
    }
  }

  async cron(): Promise<void> {
    const groups = db[this.bot.platform].collection('groups');
    const users = db[this.bot.platform].collection('users');
    const reminders = db[this.bot.platform].collection('reminders');
    const expired = reminders.find({ alarm: { $lt: now() } });

    let reminder = await expired.next();

    while (reminder) {
      if (String(reminder.bot) == String(this.bot.user.id)) {
        let chat;
        const group = await groups.findOne({ id: reminder.chatId });
        const user = await users.findOne({ id: reminder.chatId });
        if (String(reminder.chatId).startsWith('-')) {
          chat = new Conversation(reminder.chatId, group.title);
        } else {
          chat = new Conversation(reminder.chatId, user.first_name);
        }

        let name = reminder.firstName;
        let username = reminder.username;
        if (reminder.userId) {
          name = await getFullName(this.bot, reminder.userId, false);
          username = (await getUsername(this.bot, reminder.userId)).slice(1);
        }
        let text = `<i>${reminder.text}</i>\n - ${name}`;
        if (username && username.length > 0) {
          text += ` (@${username})`;
        }
        this.bot.sendMessage(chat, text);
        await reminders.deleteOne({ _id: reminder._id });
        reminder = await expired.next();
      }
    }
  }

  generateAlarm(delay: string, unit: string): number {
    const alarm = now();
    if (
      unit == this.strings.second ||
      unit == this.strings.seconds ||
      unit == 's' ||
      unit == 'sec' ||
      unit == 'secs' ||
      unit == 'second' ||
      unit == 'seconds'
    ) {
      return now() + parseFloat(delay);
    } else if (
      unit == this.strings.minute ||
      unit == this.strings.minutes ||
      unit == 'm' ||
      unit == 'min' ||
      unit == 'mins' ||
      unit == 'minute' ||
      unit == 'minutes'
    ) {
      return now() + parseFloat(delay) * 60;
    } else if (
      unit == this.strings.hour ||
      unit == this.strings.hours ||
      unit == 'h' ||
      unit == 'hour' ||
      unit == 'hours'
    ) {
      return now() + parseFloat(delay) * 60 * 60;
    } else if (
      unit == this.strings.day ||
      unit == this.strings.days ||
      unit == 'd' ||
      unit == 'day' ||
      unit == 'days'
    ) {
      return now() + parseFloat(delay) * 60 * 60 * 24;
    }
    return alarm;
  }
}
