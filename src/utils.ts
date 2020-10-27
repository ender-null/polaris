import { exec } from 'child_process';
import fetch from 'node-fetch';
import util from 'util';
import { createLogger, format, transports } from 'winston';
import { Bot, Message, PluginBase } from '.';
import { db } from './main';

export function isTrusted(bot: Bot, uid: number | string, msg: Message = null): boolean {
  return hasTag(uid, 'trusted') || msg.sender.id == bot.config.owner;
}

export function hasTag(target: number | string, tag: string): boolean {
  if (typeof target != 'string') {
    target = String(target);
  }
  const targetTags = db.tags.child(target).exists();
  if (targetTags && tag.indexOf('?') > -1) {
    for (const target_tag of db.tags.child(target).exists()) {
      if (target_tag.startsWith(tag.split('?')[0])) {
        return true;
      }
    }
    return false;
  } else if (targetTags && db.tags.child(target).val().indexOf(tag) > -1) {
    return true;
  } else {
    return false;
  }
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
    if (new RegExp(trigger, 'gim').test(text)) {
      return true;
    }
  }

  if ('friendly' in plugin.commands[number - 1]) {
    trigger = plugin.commands[number - 1].friendly;
    if (new RegExp(trigger, 'gim').test(text)) {
      return true;
    }
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
    if (new RegExp(trigger, 'gim').test(text)) {
      return true;
    }
  }
  return false;
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

export function sendRequest(url: string, params: any = {}) {
  const init = {
    body: params,
  };
  return fetch(url, init)
    .then((data) => {
      return data.json();
    })
    .then((res) => logger.info(res))
    .catch((error) => logger.error(error));
}

export function getExtension(filename: string) {
  return '.' + filename.split('.')[1];
}

export function removeHtml(text: string): string {
  return text.replace(new RegExp('<[^<]+?>', 'gim'), '');
}

export function replaceHtml(text: string): string {
  text = text.replace('&lt;', '<');
  text = text.replace('&gt;', '>');
  return text;
}

export function htmlToDiscordMarkdown(text: string): string {
  const replacements = [
    { pattern: '<code class="language-([w]+)">([Ss]+)</code>', sub: '```$1\n$2```' },
    // {pattern: '<a href=\"(.[^\<]+)\">(.[^\<]+)</a>', sub: '[$2]($1)'},
    { pattern: '<a href="(.[^<]+)">(.[^<]+)</a>', sub: '$1' },
    { pattern: '<[/]?i>', sub: '_' },
    { pattern: '<[/]?b>', sub: '**' },
    { pattern: '<[/]?u>', sub: '__' },
    { pattern: '<[/]?code>', sub: '`' },
    { pattern: '<[/]?pre>', sub: '```' },
  ];

  for (const rep of replacements) {
    text = text.replace(new RegExp(rep['pattern'], 'gim'), rep['sub']);
  }

  text = replaceHtml(text);
  return text;
}

export function splitLargeMessage(content: string, maxLength: number): string[] {
  const lineBreak = '\n';
  const lines = content.split(lineBreak);
  const texts = [];
  let text = '';
  let length = 0;

  for (const line of lines) {
    if (length + line.length + lineBreak.length < maxLength) {
      text += line + lineBreak;
      length += line.length + lineBreak.length;
    } else {
      texts.push(text);
      text = line + lineBreak;
      length += line.length + lineBreak.length;
    }
  }
  return texts;
}

// Configure logger
export const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.Console({
      format: format.combine(format.simple(), format.colorize()),
    }),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
  ],
});

export async function execResult(command: string) {
  const { stdout } = await util.promisify(exec)(command);
  return stdout;
}
