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
        Object.keys(db.pins).map((pin) => {
          if (db.pins[pin].creator == msg.sender.id && db.pins[pin].bot == this.bot.user.id) {
            pins.push(pin);
          }
        });
      }
      let text = '';
      if (pins.length > 0) {
        text = format(this.strings.pins, pins.length);
        pins.map((pin) => {
          text += `\n • #${pin}`;
        });
      } else {
        text = this.strings.noPins;
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
        return this.bot.replyMessage(msg, format(this.strings.alreadyPinned, tag));
      }
      let pinType;
      if (msg.reply.type == 'text' && msg.reply.content.startsWith(this.bot.config.prefix)) {
        pinType = 'command';
      } else {
        pinType = msg.reply.type;
      }
      db.pinsSnap.child(tag).ref.set({
        content: msg.reply.content.replace(/</gim, '&lt;').replace(/>/gim, '&gt;'),
        creator: msg.sender.id,
        type: pinType,
        bot: this.bot.user.id,
      });
      db.pins[tag] = {
        content: msg.reply.content.replace(/</gim, '&lt;').replace(/>/gim, '&gt;'),
        creator: msg.sender.id,
        type: pinType,
        bot: this.bot.user.id,
      };
      this.bot.replyMessage(msg, format(this.strings.pinned, tag));
      this.updateTriggers();
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
        return this.bot.replyMessage(msg, format(this.strings.notFound, tag));
      }
      if (db.pins && msg.sender.id != db.pins[tag].creator) {
        return this.bot.replyMessage(msg, format(this.strings.notCreator, tag));
      }
      db.pinsSnap.child(tag).ref.set(null);
      delete db.pins[tag];
      this.bot.replyMessage(msg, format(this.strings.unpinned, tag));
      this.updateTriggers();
    } else {
      // Finds the first 3 pins of the message and sends them.
      const pins = new RegExp('#(\\w+)', 'gim').exec(msg.content);
      let count = 3;
      if (pins) {
        pins.map((pin) => {
          if (pin in db.pins && count > 0) {
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
          return null;
        });
      }
    }
  }

  updateTriggers(): void {
    if (db.pins) {
      const addedPins = [];
      this.commands.map((command) => {
        if (command.command.startsWith('#')) {
          addedPins.push(command.command.slice(1));
        }
      });

      // Add new triggers
      Object.keys(db.pins).map((pin) => {
        if (addedPins.indexOf(pin) == -1)
          this.commands.push({
            command: '#' + pin,
            hidden: true,
          });
      });

      // Remove unused triggers
      this.commands.map((command, i) => {
        if ('hidden' in command && command.hidden && Object.keys(db.pins).indexOf(command.command.slice(1)) == -1) {
          this.commands.splice(i, 1);
        }
      });
    }
  }
}
