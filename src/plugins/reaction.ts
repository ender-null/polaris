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
    if (hasTag(this.bot, msg.conversation.id, 'noreactions') || hasTag(this.bot, msg.sender.id, 'noreactions')) {
      return;
    }
    for (const reaction in this.data) {
      for (const triggerIndex in this.data[reaction]) {
        if (new RegExp(this.data[reaction][triggerIndex], 'gim').test(msg.content)) {
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
    if (this.bot.user) {
      text = text.replace(
        new RegExp('BOT', 'gm'),
        escapeMarkdown(this.bot.user.username.toLowerCase().replace('bot', '')),
      );
    }
    if (message) {
      if (+message.sender.id > 0) {
        text = text.replace(new RegExp('USER', 'gm'), escapeMarkdown(message.sender['firstName']));
      } else {
        text = text.replace(new RegExp('USER', 'gm'), escapeMarkdown(message.sender['title']));
      }
    }
    return text;
  }
}
