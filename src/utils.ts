import { Bot, Message } from '.';
import { logger } from './main';
import { PluginBase } from './plugin';

export function isTrusted(bot: Bot, uid: number | string, msg: Message = null): boolean {
  logger.debug('hasTag', bot, uid, msg);
  return true;
}

export function hasTag(bot: Bot, target: number | string, tag: string): boolean {
  logger.debug('hasTag', bot, target, tag);
  return false;
}

export function setInput(message: Message, trigger: string): Message {
  if (message.type == 'text') {
    // Get the text that is next to the pattern
    const inputMatch = new RegExp(`${trigger}(.+)$`, 'gim').exec(message.content);
    if (inputMatch && inputMatch.length > 0) {
      message.extra.input = inputMatch[1];
    }

    // Get the text that is next to the pattern
    if (message.reply && message.reply.content) {
      const inputMatch = new RegExp(`${trigger}(.+)$`, 'gim').exec(
        String(message.content) + ' ' + String(message.reply.content),
      );
      if (inputMatch && inputMatch.length > 0) {
        message.extra.inputReply = inputMatch[1];
      }
    } else if ('input' in message.extra) {
      message.extra.inputReply = message.extra['input'];
    }
    return message;
  }
  return message;
}

export function getInput(message: Message, ignoreReply = true): string {
  if (Object.keys(message.extra).length > 0) {
    if (ignoreReply && 'input' in message.extra) {
      return message.extra.input;
    } else if (!ignoreReply && 'inputReply' in message.extra) {
      return message.extra.inputReply;
    }
  }
  return null;
}
export function isCommand(plugin: PluginBase, number: number, text: string): boolean {
  if (typeof text == 'string' && text.endsWith(`@${plugin.bot.user.username}`) && text.indexOf(' ') > -1) {
    text = text.replace(`@${plugin.bot.user.username}`, '');
  }

  let trigger = null;

  if (number - 1 < plugin.commands.length && 'command' in plugin.commands[number - 1]) {
    if (
      (plugin.commands[number - 1].command == '/start' && text.indexOf('/start') > -1) ||
      (plugin.commands[number - 1].command == '/help' && text.indexOf('/help') > -1)
    ) {
      trigger = plugin.commands[number - 1].command.replace('/', '^/');
    } else {
      if (text[0] == '/' && 'keepDefault' in plugin.commands[number - 1] && plugin.commands[number - 1].keepDefault) {
        trigger = plugin.commands[number - 1].command.replace('/', '^/');
      } else {
        trigger = plugin.commands[number - 1].command.replace('/', plugin.bot.config.prefix).toLocaleLowerCase();
      }
    }

    if (!('parameters' in plugin.commands[number - 1]) && trigger.startsWith('^')) {
      trigger += '$';
    } else if ('parameters' in plugin.commands[number - 1] && text.indexOf('/start') == -1) {
      trigger += '$';
    } else if ('parameters' in plugin.commands[number - 1] && text.indexOf('/start') > -1) {
      trigger += ' ';
    }
  }

  if ('friendly' in plugin.commands[number - 1]) {
    trigger = plugin.commands[number - 1].friendly;
  }
  if ('shortcut' in plugin.commands[number - 1]) {
    trigger = plugin.commands[number - 1].shortcut.replace('/', plugin.bot.config.prefix).toLocaleLowerCase();

    if (!('parameters' in plugin.commands[number - 1]) && trigger.startsWith('^')) {
      trigger += '$';
    } else if ('parameters' in plugin.commands[number - 1] && text.indexOf('/start') == -1) {
      trigger += '$';
    } else if ('parameters' in plugin.commands[number - 1] && text.indexOf('/start') > -1) {
      trigger += ' ';
    }
  }
  return new RegExp(trigger, 'gim').test(text);
}

export function getCommandIndex(plugin: PluginBase, text: string): number {
  if (typeof text == 'string' && text.endsWith(`@${plugin.bot.user.username}`) && text.indexOf(' ') > -1) {
    text = text.replace(`@${plugin.bot.user.username}`, '');
  }

  text = text.replace('/', plugin.bot.config['prefix']);

  for (const i in plugin.commands) {
    if (isCommand(plugin, parseInt(i) + 1, text)) {
      return parseInt(i);
    }
  }

  return null;
}

export function generateCommandHelp(plugin: PluginBase, text: string, showHidden = true): string {
  const index = getCommandIndex(plugin, text);
  if (index == null) {
    return null;
  }

  const command = plugin.commands[index];
  if (!showHidden && 'hidden' in command && command.hidden) {
    return null;
  }

  let doc = command['command'].replace('/', plugin.bot.config.prefix);

  if ('parameters' in command && command.parameters) {
    for (const i in command.parameters) {
      // Bold for required parameters, and italic for optional
      if (command.parameters[i].required) {
        doc += ` <b>&lt;${command.parameters[i].name}&gt;</b>`;
      } else {
        doc += ` [${command.parameters[i].name}]`;
      }
    }
  }

  if ('description' in command) {
    doc += `\n<i>${command.description}</i>`;
  }

  return doc;
}
