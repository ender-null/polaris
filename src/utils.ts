import { Bot, Message } from '.';

export function isTrusted(bot: Bot, uid: number | string, m: Message = null): boolean {
  return true;
}

export function hasTag(bot: Bot, target: number | string, tag: string): boolean {
  return false;
}

export function setInput(message: Message, trigger: string): Message {
  if (message.type == 'text') {
    // Get the text that is next to the pattern
    const inputMatch = message.content.match(/trigger + '(.+)$'/gi);
    if (inputMatch) {
      message.extra['input'] = inputMatch;
    }

    // Get the text that is next to the pattern
    if (message.reply && message.reply.content) {
      const inputMatch = String(message.content) + ' ' + String(message.reply.content).match(/trigger + '(.+)$'/gi);
      if (inputMatch) {
        message.extra['input_reply'] = inputMatch;
      } else if ('input' in message.extra) {
        message.extra['input_reply'] = message.extra['input'];
      }
    }
    return message;
  }
}
