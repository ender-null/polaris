import format from 'string-format';
import { Bot, Message } from '..';
import { db } from '../main';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getInput, isCommand } from '../utils';

export class PinPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/pins',
        description: 'Lists the pins of the current user.',
      },
      {
        command: '/pin',
        parameters: [
          {
            name: 'name',
            required: false,
          },
        ],
        description: 'Sets a pin.',
      },
      {
        command: '/unpin',
        parameters: [
          {
            name: 'name',
            required: false,
          },
        ],
        description: 'Deletes a pin.',
      },
    ];
    this.strings = {
      alreadyPinned: "<b>#{0}</b> already exists, can't be set.",
      noPins: "You don't have any pin yet.",
      notCreator: "<b>#{0}</b> you don't have permission to delete it.",
      notFound: "<b>#{0}</b> doesn't exist.",
      pinned: '<b>#{0}</b> was set',
      pins: '<b>You created {0} pins</b>:',
      unpinned: '<b>#{0}</b> was deleted.',
    };
    this.updateTriggers();
  }

  afterTranslation(): void {
    this.updateTriggers();
  }

  async run(msg: Message): Promise<void> {
    const input = getInput(msg);
    if (isCommand(this, 1, msg.content)) {
      const pins = [];
      if (db.pins) {
        for (const pin in db.pins) {
          if (db.pins[pin].creator == msg.sender.id && db.pins[pin].bot == this.bot.user.id) {
            pins.push(pin);
          }
        }
      }
      let text = '';
      if (pins.length > 0) {
        text = format(this.strings['pins'], pins.length);
        for (const pin of pins) {
          text += `\n • #${pin}`;
        }
      } else {
        text = this.strings['noPins'];
      }
      return this.bot.replyMessage(msg, text);
    } else if (isCommand(this, 2, msg.content)) {
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      if (!msg.reply) {
        return this.bot.replyMessage(msg, this.bot.errors.needsReply);
      }
      let tag = input;
      if (tag.startsWith('#')) {
        tag = input.slice(1);
      }
      tag = tag.toLowerCase();
      if (db.pins && Object.keys(db.pins).indexOf(tag) > -1) {
        return this.bot.replyMessage(msg, format(this.strings['alreadyPinned'], tag));
      }
      let pinType;
      if (msg.reply.type == 'text' && msg.reply.content.startsWith(this.bot.config.prefix)) {
        pinType = 'command';
      } else {
        pinType = msg.reply.type;
      }
      db.pinsSnap.child(tag).ref.set({
        content: msg.reply.content.replace('<', '&lt;').replace('>', '&gt;'),
        creator: msg.sender.id,
        type: pinType,
        bot: this.bot.user.id,
      });
      db.pins[tag] = {
        content: msg.reply.content.replace('<', '&lt;').replace('>', '&gt;'),
        creator: msg.sender.id,
        type: pinType,
        bot: this.bot.user.id,
      };
      this.bot.replyMessage(msg, format(this.strings['pinned'], tag));
    } else if (isCommand(this, 3, msg.content)) {
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      let tag = input;
      if (tag.startsWith('#')) {
        tag = input.slice(1);
      }
      tag = tag.toLowerCase();
      if (db.pins && Object.keys(db.pins).indexOf(tag) == -1) {
        return this.bot.replyMessage(msg, format(this.strings['notFound'], tag));
      }
      if (db.pins && msg.sender.id != db.pins[tag].creator) {
        return this.bot.replyMessage(msg, format(this.strings['notCreator'], tag));
      }
      db.pinsSnap.child(tag).ref.set(null);
      delete db.pins[tag];
      this.bot.replyMessage(msg, format(this.strings['unpinned'], tag));
    } else {
      // Finds the first 3 pins of the message and sends them.
      const pins = new RegExp('#(\\w+)', 'gim').exec(msg.content);
      let count = 3;
      if (pins) {
        for (const pin of pins) {
          if (pin in db.pins) {
            if (
              db.pins[pin].content != undefined &&
              db.pins[pin].type != undefined &&
              db.pins[pin].bot == this.bot.user.id
            ) {
              if (db.pins[pin].type == 'command') {
                msg.content = db.pins[pin].content;
                return this.bot.onMessageReceive(msg);
              } else {
                const reply = msg.reply ? msg.reply : msg;
                this.bot.replyMessage(msg, db.pins[pin].content, db.pins[pin].type, reply);
              }
              count -= 1;
            }
          }
          count -= 1;
          if (count == 0) {
            break;
          }
        }
      }
    }
  }

  updateTriggers(): void {
    if (db.pins) {
      const addedPins = [];
      for (const command of this.commands) {
        if (command.command.startsWith('#')) {
          addedPins.push(command.command.slice(1));
        }
      }

      // Add new triggers
      for (const pin in db.pins) {
        if (addedPins.indexOf(pin) == -1)
          this.commands.push({
            command: '#' + pin,
            hidden: true,
          });
      }

      // Remove unused triggers
      for (const command of this.commands) {
        if ('hidden' in command && command.hidden && Object.keys(db.pins).indexOf(command.command.slice(1)) == -1) {
          this.commands.splice(this.commands.indexOf(command), 1);
        }
      }
    }
  }
}
