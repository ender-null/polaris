import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { escapeMarkdown, hasTag } from '../utils';

export class ReactionPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.data = {
      'Konban wa! 😊': ['buenas noches'],
      'Konnichi wa! 😊': ['buenas tardes', 'hi', 'hol[a|i(wis)?]', 'buenas'],
      'Ohayō! 😊': ['buenos d[i|í]as'],
      'Sonríe, eres especial! ☺️': ['😢', ':c', ':\\('],
    };
    this.updateTriggers();
  }

  afterTranslation(): void {
    this.updateTriggers();
  }

  async run(msg: Message): Promise<void> {
    if (
      (await hasTag(this.bot, msg.conversation.id, 'noreactions')) ||
      (await hasTag(this.bot, msg.sender.id, 'noreactions'))
    ) {
      return;
    }
    for (const reaction in this.data) {
      for (const triggerIndex in this.data[reaction]) {
        const trigger = this.formatText(this.data[reaction][triggerIndex], msg);
        if (new RegExp(trigger, 'gim').test(msg.content)) {
          const text = this.formatText(reaction, msg);
          const types = ['photo', 'audio', 'document', 'voice', 'sticker', 'video'];
          for (const type in types) {
            if (text.startsWith(type + ':')) {
              return this.bot.replyMessage(msg, text.split(':')[1], type);
            }
          }
          return this.bot.replyMessage(msg, text, 'text', null, { format: 'Markdown' });
        }
      }
    }
  }

  updateTriggers(): void {
    this.commands = [];
    for (const reaction in this.data) {
      for (const triggerIndex in this.data[reaction]) {
        this.commands.push({
          command: '(^| )' + this.formatText(this.data[reaction][triggerIndex]) + '.?($| )',
          hidden: true,
        });
      }
    }
  }

  formatText(text: string, message?: Message): string {
    if (text) {
      if (this.bot.user) {
        text = text.replace(
          new RegExp('BOT', 'gim'),
          this.bot.user.username.toLowerCase().replace('bot', '').split('#')[0],
        );
      }
      if (message) {
        let name;
        let username;
        if (+message.sender.id > 0) {
          name = message.sender['firstName'];
          username = '@' + message.sender['username'];
        } else {
          name = message.sender['title'];
        }
        if (username) {
          text = text.replace(new RegExp('USERNAME', 'gm'), escapeMarkdown(username));
        } else {
          text = text.replace(new RegExp('USERNAME', 'gm'), escapeMarkdown(name));
        }
        text = text.replace(new RegExp('USER', 'gm'), escapeMarkdown(name));
      }
    }
    return text;
  }
}
