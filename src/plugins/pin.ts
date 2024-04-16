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
    const uid = String(msg.sender.id);
    const bid = String(this.bot.user.id);
    const pins = db[this.bot.platform].collection('pins');
    const ownPins = await pins.find({ creator: uid, bot: bid }).toArray();
    if (isCommand(this, 1, msg.content)) {
      let text = '';
      if (ownPins.length > 0) {
        text = format(this.strings.pins, ownPins.length);
        ownPins.map((pin) => {
          text += `\n • #${pin.tag}`;
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
      if (ownPins.length && ownPins.find((pin) => pin['tag'] === tag)) {
        return this.bot.replyMessage(msg, format(this.strings.alreadyPinned, tag));
      }
      let pinType;
      if (msg.reply.type == 'text' && msg.reply.content.startsWith(this.bot.config.prefix)) {
        pinType = 'command';
      } else {
        pinType = msg.reply.type;
      }
      pins.insertOne({
        tag,
        content: msg.reply.content.replace(/</gim, '&lt;').replace(/>/gim, '&gt;'),
        creator: uid,
        type: pinType,
        bot: bid,
      });
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
      if (ownPins.length && ownPins.map((pin) => pin.tag).indexOf(tag) == -1) {
        return this.bot.replyMessage(msg, format(this.strings.notFound, tag));
      }
      const foundPin = await pins.findOne({ tag });
      if (uid != foundPin.creator) {
        return this.bot.replyMessage(msg, format(this.strings.notCreator, tag));
      }
      pins.deleteOne({ tag });
      this.bot.replyMessage(msg, format(this.strings.unpinned, tag));
      this.updateTriggers();
    } else {
      // Finds the first 3 pins of the message and sends them.
      const pinsInMsg = new RegExp('#(\\w+)', 'gim').exec(msg.content);
      let count = 3;
      if (pinsInMsg) {
        pinsInMsg.map(async (pin) => {
          const foundPin = await pins.findOne({ tag: pin });
          if (foundPin && count > 0) {
            if (
              foundPin['content'] != undefined &&
              foundPin['type'] != undefined &&
              foundPin['bot'] == this.bot.user.id
            ) {
              if (foundPin['type'] == 'command') {
                msg.content = foundPin['content'];
                return this.bot.onMessageReceive(msg);
              } else {
                const reply = msg.reply ? msg.reply : msg;
                this.bot.replyMessage(msg, foundPin['content'], foundPin['type'], reply);
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
    const pins = db[this.bot.platform].collection('pins');
    pins
      .find({ bot: String(this.bot.user.id) })
      .toArray()
      .then((pins_) => {
        if (pins_) {
          const addedPins = [];
          this.commands.map((command) => {
            if (command.command.startsWith('#')) {
              addedPins.push(command.command.slice(1));
            }
          });

          pins_.map((pin) => {
            console.log('addedPins', addedPins, 'pin.tag', pin.tag, addedPins.indexOf(pin.tag));
            if (addedPins.indexOf(pin.tag) == -1) {
              console.log('not added', pin.tag);
              this.commands.push({
                command: '#' + pin.tag,
                hidden: true,
              });
            }
          });

          // Remove unused triggers
          this.commands.map((command, i) => {
            if (
              'hidden' in command &&
              command.hidden &&
              pins_.map((pin) => pin.tag).indexOf(command.command.slice(1)) == -1
            ) {
              this.commands.splice(i, 1);
            }
          });
        }
      });
  }
}
