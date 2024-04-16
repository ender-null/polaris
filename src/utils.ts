/* eslint-disable @typescript-eslint/no-explicit-any */
import { exec } from 'child_process';
import fs from 'fs';
import mime from 'mime-types';
import fetch, { BodyInit, HeadersInit, RequestInit, Response } from 'node-fetch';
import os from 'os';
import { ParsedUrlQueryInput } from 'querystring';
import { pipeline } from 'stream';
import { FileResult, fileSync } from 'tmp';
import util from 'util';
import winston, { createLogger, transports, format as winstonFormat } from 'winston';
import 'winston-daily-rotate-file';
import { db } from './main';
import { CoordinatesResult, HTTPResponseError, Message, iString } from './types';
import { Bot } from './bot';
import { PluginBase } from './plugin';

export const getPluginSlug = (plugin: PluginBase): string => {
  return plugin.constructor.name.replace('Plugin', '').toLowerCase();
};

export const isOwner = async (bot: Bot, uid: number | string, msg: Message = null): Promise<boolean> => {
  return (await hasTag(bot, uid, 'owner')) || (msg && msg.sender.id == bot.config.owner);
};

export const isAdmin = async (bot: Bot, uid: number | string, msg: Message = null): Promise<boolean> => {
  return (await hasTag(bot, uid, 'admin')) || (await isGroupAdmin(bot, uid, msg));
};

export const isMod = async (bot: Bot, uid: number | string, gid: number | string): Promise<boolean> => {
  if (typeof uid != 'string') {
    uid = String(uid);
  }

  if ((await hasTag(bot, uid, 'globalmod')) || (await hasTag(bot, uid, `mod:${gid}`))) {
    return true;
  } else {
    return false;
  }
};

export const isGroupAdmin = async (bot: Bot, uid: number | string, msg: Message = null): Promise<boolean> => {
  if (typeof uid != 'string') {
    uid = String(uid);
  }
  if (msg && +msg.conversation.id < 0) {
    const chatAdmins = await bot.bindings.getChatAdministrators(msg.conversation.id);
    if (chatAdmins) {
      for (const admin of chatAdmins) {
        if (uid == String(admin.id)) {
          return true;
        }
      }
    }
  }
  return false;
};

export const isTrusted = async (bot: Bot, uid: number | string, msg: Message = null): Promise<boolean> => {
  return (await hasTag(bot, uid, 'trusted')) || isOwner(bot, uid, msg);
};

export const getTags = async (bot: Bot, target: number | string, tagFilter?: string): Promise<string[]> => {
  if (typeof target != 'string') {
    target = String(target);
  }
  const tags = db[bot.platform].collection('tags');
  const tag = await tags.findOne({ id: target });
  if (tag) {
    const tags_ = [];
    Object.keys(tag.list).map((i) => {
      const tag_ = tag.list[i];
      if (tagFilter && tagFilter.indexOf('?') > -1 && !tag_.startsWith(tagFilter.split('?')[0])) {
        return;
      }
      const inputMatch = tagForBotRegExp.exec(tag_);
      if (inputMatch) {
        if (inputMatch && (inputMatch[1] === bot.config.name || inputMatch[1] === bot.user.username)) {
          tags_.push(tag_.replace(tagForBotRegExp, ''));
        }
      } else {
        tags_.push(tag_);
      }
    });
    return tags_;
  }
  return [];
};

export const getTaggedWith = async (bot: Bot, tag: string): Promise<string[]> => {
  const subs = [];
  for (const gid in db.groups) {
    if (await hasTag(bot, gid, tag)) {
      subs.push(gid);
    }
  }
  for (const uid in db.users) {
    if (await hasTag(bot, uid, tag)) {
      subs.push(uid);
    }
  }
  return subs;
};

export const hasTag = async (bot: Bot, target: number | string, tag: string): Promise<boolean> => {
  if (typeof target != 'string') {
    target = String(target);
  }
  const tags = await getTags(bot, target);
  if (tags && tag.indexOf('?') > -1) {
    for (const targetTag of tags) {
      if (targetTag.startsWith(tag.split('?')[0])) {
        return true;
      }
    }
    return false;
  } else if (tags && tags.indexOf(tag) > -1) {
    return true;
  } else {
    return false;
  }
};

export const setTag = async (bot: Bot, target: number | string, tag: string): Promise<void> => {
  if (typeof target != 'string') {
    target = String(target);
  }
  const allTags = await getTags(bot, target);
  if (allTags && allTags.indexOf(tag) == -1) {
    let found = false;
    const tags = db[bot.platform].collection('tags');
    const currentTags = await tags.findOne({ id: target });
    if (currentTags && currentTags.list.length && tag.indexOf(':') > -1) {
      for (const i of Object.keys(currentTags.list)) {
        const targetTag = currentTags.list[i];
        if (targetTag.startsWith(tag.split(':')[0] + ':')) {
          currentTags.list[i] = tag;
          found = true;
          break;
        }
      }
    }
    if (found == false) {
      if (currentTags && currentTags.list.length) {
        tags.updateOne(
          { id: target },
          {
            $set: {
              list: [...currentTags.list, tag].sort(),
            },
          },
        );
      } else {
        tags.insertOne({
          id: target,
          list: [tag],
        });
      }
    }
  }
};

export const delTag = async (bot: Bot, target: number | string, tag: string): Promise<void> => {
  if (typeof target != 'string') {
    target = String(target);
  }

  const tags = db[bot.platform].collection('tags');
  const currentTags = await tags.findOne({ id: target });

  if (currentTags && currentTags.list) {
    const tagList = currentTags.list;
    for (const i of Object.keys(tagList)) {
      let targetTag = tagList[i];
      const inputMatch = tagForBotRegExp.exec(targetTag);
      if (inputMatch) {
        if (inputMatch && (inputMatch[1] === bot.config.name || inputMatch[1] === bot.user.username)) {
          targetTag = targetTag.replace(tagForBotRegExp, '');
        }
      }
      if (
        (tag.indexOf('?') > -1 && targetTag.startsWith(tag.split('?')[0])) ||
        (tag.indexOf('?') == -1 && targetTag == tag)
      ) {
        delete tagList[i];
      }
    }
    tags.updateOne(
      { id: target },
      {
        $set: {
          list: tagList.sort(),
        },
      },
    );
  }
};

export const isInt = (number: number | string): boolean => {
  if (typeof number == 'number') {
    return true;
  } else if (typeof number != 'string') {
    return false;
  }
  return !isNaN(parseFloat(number));
};

export const getTarget = async (
  bot: Bot,
  m: Message,
  input: string,
  noSearch?: boolean,
  ignoreSelf?: boolean,
): Promise<string> => {
  if (m.reply) {
    return String(m.reply.sender.id);
  } else if (input) {
    const target = getWord(input, 1);
    if (target && isInt(target)) {
      return String(target);
    } else if (target && target.startsWith('@')) {
      if (bot.user.username.toLowerCase() == target.slice(1).toLowerCase()) {
        return String(bot.user.id);
      }
      const users = db[bot.platform].collection('users');
      const user = await users.findOne({ username: target });
      if (user) {
        return user.id;
      }
      const groups = db[bot.platform].collection('groups');
      const group = await groups.findOne({ username: target });
      if (group) {
        return group.id;
      }
    } else if (target && target.startsWith('<@')) {
      target.replace(new RegExp('<@!?([d]+)>', 'gim'), '$1');
    } else if (target && target == '-g') {
      return String(m.conversation.id);
    } else if (!noSearch) {
      const users = db[bot.platform].collection('users');
      const user = await users.findOne({ name: { $regex: new RegExp(target, 'gim') } });
      if (user) {
        return user.id;
      }
      const groups = db[bot.platform].collection('groups');
      const group = await groups.findOne({ name: { $regex: new RegExp(target, 'gim') } });
      if (group) {
        return group.id;
      }
    }
    if (!target) {
      return '0';
    }
    return target;
  } else if (!ignoreSelf) {
    return String(m.sender.id);
  } else {
    return '0';
  }
};

export const capitalize = (text: string, setLowercase?: boolean): string => {
  if (text) {
    if (setLowercase) {
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    } else {
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  }
  return null;
};

export const capitalizeEachWord = (text: string): string => {
  if (text) {
    if (text.indexOf(' ') > -1) {
      const words = text.split(' ');
      const capitalized = [];
      words.map((word) => {
        capitalized.push(capitalize(word));
      });
      return capitalized.join(' ');
    } else {
      return capitalize(text);
    }
  }
  return null;
};

export const camelCase = (text: string): string => {
  if (text) {
    return text
      .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, '');
  }
  return null;
};

export const getWord = (text: string, i: number): string => {
  if (text && text.indexOf(' ') > -1) {
    return text.split(' ')[i - 1];
  } else if (text && text.indexOf(' ') == -1 && i == 1) {
    return text;
  } else {
    return null;
  }
};

export const allButNWord = (text: string, word = 1): string => {
  if (!text || text.indexOf(' ') == -1) {
    return null;
  }
  return text.slice(text.indexOf(text.split(' ')[word]));
};

export const getUsername = async (bot: Bot, uid: number | string, includeNick = true): Promise<string> => {
  if (typeof uid != 'string') {
    uid = String(uid);
  }
  let name = '';
  const users = db[bot.platform].collection('users');
  const user = await users.findOne({ id: uid });
  const groups = db[bot.platform].collection('groups');
  const group = await groups.findOne({ id: uid });
  if (user) {
    if (includeNick && user.nick !== undefined) {
      name += user.nick;
    } else {
      if (user.first_name !== undefined) {
        name += user.first_name;
      }
      if (user.last_name !== undefined) {
        name += ' ' + user.last_name;
      }
    }
    if (user.username !== undefined && user.username !== '') {
      name = `@${user.username}`;
    }
  } else if (group !== undefined) {
    name = group.title;
    if (group.username !== undefined && group.username !== '') {
      name = `@${group.username}`;
    }
  } else {
    name = '[null]';
  }
  return name;
};

export const getFullName = async (bot: Bot, uid: number | string, includeUsername = true): Promise<string> => {
  if (typeof uid != 'string') {
    uid = String(uid);
  }
  const users = db[bot.platform].collection('users');
  const user = await users.findOne({ id: uid });
  const groups = db[bot.platform].collection('groups');
  const group = await groups.findOne({ id: uid });
  let name = '';
  if (user) {
    if (user['first_name'] !== undefined) {
      name += user['first_name'];
    }
    if (user['last_name'] !== undefined) {
      name += ' ' + user['last_name'];
    }

    if (includeUsername && user['username']) {
      name += ` (@${user['username']})`;
    }
  } else if (group) {
    name = group['title'];
    if (group['username']) {
      name += ` (@${group['username']})`;
    }
  } else {
    name = '[null]';
  }
  return name;
};

export const fixTelegramLink = (link: string): string => {
  const inputMatch = telegramLinkRegExp.exec(link);
  if (inputMatch && inputMatch.length > 0) {
    const fixedLink = `https://t.me/joinchat/${inputMatch[1]}`;
    logger.info(`Fixed Telegram link: ${fixedLink}`);
    return fixedLink;
  }
  return link;
};

export const telegramShortLink = (link: string): string => {
  return fixTelegramLink(link).slice(8);
};

export const setInput = (message: Message, trigger: string): Message => {
  if (message.type == 'text') {
    trigger = trigger.replace('$', '');
    // Get the text that is next to the pattern
    const inputMatch = new RegExp(`${trigger}(.+)$`, 'gim').exec(message.content);
    if (inputMatch && inputMatch.length > 0 && inputMatch[1]) {
      if (inputMatch[1].startsWith(' ')) {
        message.extra.input = inputMatch[1].slice(1);
      } else {
        message.extra.input = inputMatch[1];
      }
    }

    // Get the text that is next to the pattern
    if (message.reply && message.reply.content) {
      const inputMatch = new RegExp(`${trigger}(.+)$`, 'gim').exec(`${message.content} ${message.reply.content}`);
      if (inputMatch && inputMatch.length > 0 && inputMatch[1]) {
        if (inputMatch[1].startsWith(' ')) {
          message.extra.inputReply = inputMatch[1].slice(1);
        } else {
          message.extra.inputReply = inputMatch[1];
        }
      }
    } else if ('input' in message.extra) {
      message.extra.inputReply = message.extra.input;
    }
  }
  return message;
};

export const getInput = (message: Message, ignoreReply = true): string => {
  if (Object.keys(message.extra).length > 0) {
    if (ignoreReply && 'input' in message.extra) {
      return message.extra.input;
    } else if (!ignoreReply && 'inputReply' in message.extra) {
      return message.extra.inputReply;
    }
  }
  return null;
};
export const isCommand = (plugin: PluginBase, number: number, text: string): boolean => {
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
        trigger = plugin.commands[number - 1].command
          .replace('/', escapeRegExp(plugin.bot.config.prefix))
          .toLocaleLowerCase();
      }
    }

    if (plugin.commands[number - 1].parameters == null && trigger.startsWith('^')) {
      trigger += '$';
    } else if (plugin.commands[number - 1].parameters !== null && text.indexOf(' ') == -1) {
      trigger += '$';
    } else if (plugin.commands[number - 1].parameters !== null && text.indexOf(' ') > -1) {
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
    trigger = plugin.commands[number - 1].shortcut
      .replace('/', escapeRegExp(plugin.bot.config.prefix))
      .toLocaleLowerCase();

    if (plugin.commands[number - 1].parameters == null && trigger.startsWith('^')) {
      trigger += '$';
    } else if (plugin.commands[number - 1].parameters !== null && text.indexOf(' ') == -1) {
      trigger += '$';
    } else if (plugin.commands[number - 1].parameters !== null && text.indexOf(' ') > -1) {
      trigger += ' ';
    }
    if (new RegExp(trigger, 'gim').test(text)) {
      return true;
    }
  }
  if ('aliases' in plugin.commands[number - 1]) {
    for (const alias of plugin.commands[number - 1].aliases) {
      trigger = alias.replace('/', escapeRegExp(plugin.bot.config.prefix)).toLocaleLowerCase();

      if (plugin.commands[number - 1].parameters == null && trigger.startsWith('^')) {
        trigger += '$';
      } else if (plugin.commands[number - 1].parameters !== null && text.indexOf(' ') == -1) {
        trigger += '$';
      } else if (plugin.commands[number - 1].parameters !== null && text.indexOf(' ') > -1) {
        trigger += ' ';
      }
      if (new RegExp(trigger, 'gim').test(text)) {
        return true;
      }
    }
  }
  return false;
};

export const getCommandIndex = (plugin: PluginBase, text: string): number => {
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
};

export const generateCommandHelp = (
  plugin: PluginBase,
  text: string,
  showHidden = true,
  linkCommands = false,
): string => {
  const index = getCommandIndex(plugin, text);
  if (index == null) {
    return null;
  }

  const command = plugin.commands[index];
  if (!showHidden && 'hidden' in command && command.hidden) {
    return null;
  }

  let doc = command['command'].replace('/', plugin.bot.config.prefix);
  if (!linkCommands) {
    doc = `<code>${doc}</code>`;
  }

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

  const aliases = [];
  if ('shortcut' in command) {
    aliases.push(command.shortcut.replace('/', plugin.bot.config.prefix));
  }
  if ('aliases' in command) {
    command.aliases.map((alias) => {
      aliases.push(alias.replace('/', plugin.bot.config.prefix));
    });
  }

  if (aliases.length > 0) {
    if (!linkCommands) {
      doc += `\n\nAliases: <code>${aliases.join('</code>, <code>')}</code>`;
    } else {
      doc += `\n\nAliases: ${aliases.join(', ')}`;
    }
  }

  return doc;
};

export const queryString = (params: any) => {
  return params
    ? Object.keys(params)
        .map((key) => key + '=' + params[key])
        .join('&')
    : null;
};

export const sendRequest = async (
  url: string,
  params?: ParsedUrlQueryInput,
  headers?: HeadersInit,
  data?: BodyInit,
  post?: boolean,
  bot?: Bot,
): Promise<Response> => {
  const options: RequestInit = {
    method: post ? 'POST' : 'GET',
    body: data,
    headers: headers,
  };
  try {
    const urlWithParams = params ? `${url}?${queryString(params)}` : url;
    const response: any = await fetch(urlWithParams, options);
    if (!response.ok) {
      throw new HTTPResponseError(response);
    }
    return response;
  } catch (error) {
    catchException(error, bot);
    return null;
  }
};

export const responseUrlFromRequest = async (
  url: string,
  params?: ParsedUrlQueryInput,
  headers?: HeadersInit,
  bot?: Bot,
): Promise<string> => {
  const response = await sendRequest(url, params, headers, null, false, bot);
  if (response) {
    return response.url;
  }
  return null;
};

export const download = async (
  url: string,
  params?: ParsedUrlQueryInput,
  headers?: HeadersInit,
  post?: boolean,
  bot?: Bot,
): Promise<string> => {
  const response = await sendRequest(url, params, headers, null, post, bot);
  if (!response) {
    return null;
  }
  const contentType =
    response.headers.get('content-type') || response.headers.get('Content-Type') || 'application/octet-stream';
  const contentLength = response.headers.get('content-length') || response.headers.get('Content-Length') || '0';
  const tempfile = fileSync({ mode: 0o644, postfix: `.${mime.extension(contentType)}` });
  if (response.ok == undefined) {
    logger.error(`Unexpected response: ${response.statusText}`);
    return null;
  }
  if (contentLength == '0') {
    logger.error(`Content-Length is 0`);
    return null;
  }
  const streamPipeline = util.promisify(pipeline);
  await streamPipeline(response.body, fs.createWriteStream(tempfile.name));
  logger.info(`Downloaded file: ${tempfile.name}`);
  return tempfile.name;
};

export const getExtension = (url: string): string => {
  const filename = url.split('#').shift().split('?').shift().split('/').pop();
  if (filename.indexOf('.') > -1) {
    return `.${filename.split('.').pop()}`;
  } else {
    return '';
  }
};

export const mp3ToOgg = async (input: string): Promise<string> => {
  try {
    const output = fileSync({ mode: 0o644, postfix: `.ogg` });
    const command = `ffmpeg -i ${input} -ac 1 -c:a libopus -b:a 16k -y ${output.name}`;
    const result = await execResult(command);
    if (result != null) {
      logger.info(`Converted mp3 file to ogg: ${output.name}`);
      return output.name;
    }
    return null;
  } catch (e) {
    catchException(e);
    return null;
  }
};

export const toBase64 = (filePath): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
        return;
      }
      const base64String = data.toString('base64');
      resolve(base64String);
    });
  });
};

export const fromBase64 = (base64String): Promise<FileResult> => {
  return new Promise((resolve, reject) => {
    const bufferData = Buffer.from(base64String, 'base64');
    const file: FileResult = fileSync({ mode: 0o644 });
    fs.writeFile(file.name, bufferData, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(file);
    });
  });
};

export const getCoords = async (input: string, bot?: Bot): Promise<CoordinatesResult> => {
  let lang = 'en';
  let key = null;
  if (bot) {
    lang = bot.config.locale || 'en_US';
    key = bot.config.apiKeys.googleDeveloperConsole;
  }

  const url = 'https://maps.googleapis.com/maps/api/geocode/json';
  const params = {
    address: input,
    language: lang,
    region: lang,
    key: key,
  };
  const resp = await sendRequest(url, params, null, null, false, bot);
  if (resp) {
    const content = (await resp.json()) as any;
    if (content && content.results.length > 0) {
      const locality = content.results[0].address_components[0].long_name;
      let country;
      content.results[0].address_components.map((address) => {
        if (address.types.indexOf('country') > -1) {
          country = address.long_name;
        }
      });
      return {
        status: content.status,
        lat: content.results[0].geometry.location.lat,
        lng: content.results[0].geometry.location.lng,
        locality: locality,
        country: country,
      };
    }
  }
  return {
    status: 'ERROR',
    lat: null,
    lng: null,
    locality: null,
    country: null,
  };
};

export const removeHtml = (text: string): string => {
  if (text) {
    text = text.replace(new RegExp('<[^<]+?>', 'gim'), '');
  }
  return text;
};

export const replaceHtml = (text: string): string => {
  if (text) {
    text = text.replace(new RegExp('<', 'gim'), '&lt;');
    text = text.replace(new RegExp('>', 'gim'), '&gt;');
  }
  return text;
};

export const escapeHtml = (text: string): string => {
  if (text) {
    text = text.replace(new RegExp('<', 'gim'), '\\<');
    text = text.replace(new RegExp('>', 'gim'), '\\>');
  }
  return text;
};

export const escapeMarkdown = (text: string): string => {
  if (text) {
    text = text.replace(new RegExp('[_\\*\\(\\)\\[\\]~`]', 'gim'), '\\$&');
  }
  return text;
};

export const escapeRegExp = (text: string): string => {
  if (text) {
    text = text.replace(new RegExp('[-\\^$*+?.()|[]{}]', 'gim'), '\\$&');
  }
  return text;
};

export const htmlToMarkdown = (text: string): string => {
  if (text) {
    text = text.replace(new RegExp('<a href="(.*?)">(.*?)</a>', 'gim'), '[$2]($1)');
    text = text.replace(new RegExp('<i>(.*?)</i>', 'gim'), '_$1_');
    text = text.replace(new RegExp('<b>(.*?)</b>', 'gim'), '*$1*');
    text = text.replace(new RegExp('<u>(.*?)</u>', 'gim'), '~$1~');
    text = text.replace(new RegExp('<code>(.*?)</code>', 'gim'), '`$1`');
    text = text.replace(new RegExp('<pre>(.*?)</pre>', 'gim'), '```$1```');

    text = text.replace(new RegExp('&lt;', 'gim'), '<');
    text = text.replace(new RegExp('&gt;', 'gim'), '>');
  }
  return text;
};

export const htmlToMarkdownLegacy = (text: string): string => {
  if (text) {
    const replacements = [
      { pattern: '<code class="language-([\\w]+)">([\\S\\s]+)</code>', sub: '```$1\n$2```' },
      { pattern: '<a href="(.[^<]+)">(.[^<]+)</a>', sub: '$1' },
      { pattern: '<[/]?i>', sub: '_' },
      { pattern: '<[/]?b>', sub: '*' },
      { pattern: '<[/]?u>', sub: '~' },
      { pattern: '<[/]?code>', sub: '`' },
      { pattern: '<[/]?pre>', sub: '```' },
    ];
    replacements.map((rep) => {
      text = text.replace(new RegExp(rep['pattern'], 'gim'), rep['sub']);
    });
    text = text.replace(new RegExp('&lt;', 'gim'), '<');
    text = text.replace(new RegExp('&gt;', 'gim'), '>');
  }
  return text;
};

export const htmlToDiscordMarkdown = (text: string): string => {
  if (text) {
    const replacements = [
      { pattern: '<code class="language-([\\w]+)">([\\S\\s]+)</code>', sub: '```$1\n$2```' },
      { pattern: '<a href="(.[^<]+)">(.[^<]+)</a>', sub: '$1' },
      { pattern: '<[/]?i>', sub: '_' },
      { pattern: '<[/]?b>', sub: '**' },
      { pattern: '<[/]?u>', sub: '__' },
      { pattern: '<[/]?code>', sub: '`' },
      { pattern: '<[/]?pre>', sub: '```' },
    ];
    replacements.map((rep) => {
      text = text.replace(new RegExp(rep['pattern'], 'gim'), rep['sub']);
    });
    text = text.replace(new RegExp('&lt;', 'gim'), '<');
    text = text.replace(new RegExp('&gt;', 'gim'), '>');
  }
  return text;
};

export const splitLargeMessage = (content: string, maxLength: number): string[] => {
  const lineBreak = '\n';
  const texts = [];
  if (content) {
    const lines = content.split(lineBreak);
    let text = '';

    lines.map((line) => {
      if (text.length + line.length + lineBreak.length < maxLength) {
        text += line + lineBreak;
      } else {
        texts.push(text);
        text = line + lineBreak;
      }
    });
    texts.push(text);
  }
  return texts;
};

export const formatNumber = (number: string | number): string => {
  if (typeof number == 'string') {
    number = parseInt(number);
  }
  return number.toLocaleString(undefined);
};

export const sortList = (list: iString): iString => {
  const sorted: iString = {};
  for (let i = 0; i < Object.keys(list).length; i++) {
    sorted[i] = list[Object.keys(list)[i]];
  }
  return sorted;
};

export const now = (): number => {
  return new Date().getTime() / 1000;
};

export const time = (hour: number, minute?: number, second?: number): number => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute, second).getTime();
};

export const timeInRange = (start: number, end: number, time: number): boolean => {
  if (time >= start && time < end) {
    return true;
  }
  return false;
};

export const btoa = (text: string): string => {
  return Buffer.from(text).toString('base64');
};

export const random = (min: number, max: number): number => {
  return Math.round(Math.random() * (max - min) + min);
};

export const lstrip = (str: string, strip: string): string => {
  while (str[0] == strip) {
    str = str.slice(1);
  }
  return str;
};

export const rstrip = (str: string, strip: string): string => {
  while (str[str.length - 1] == strip) {
    str = str.slice(0, str.length - 2);
  }
  return str;
};

export const merge = (base: any, extension: any): any => {
  const merged = { ...base };
  for (const key of Object.keys(extension)) {
    if (base[key]) {
      if (Object.prototype.toString.call(base[key]) === '[object Object]') {
        merged[key] = merge(base[key], extension[key]);
      } else {
        merged[key] = extension[key];
      }
    } else {
      merged[key] = extension[key];
    }
  }
  return merged;
};

export const catchException = (exception: Error, bot: Bot = null, message: Message = null): Error => {
  logger.error(`Catch exception: ${exception.message}`);
  console.error(exception['stack']);
  if (bot) {
    if (exception['response']) {
      (exception as HTTPResponseError).response
        .json()
        .then((text) => bot.sendAlert(JSON.stringify(text, null, 4), 'json'));
    } else if (exception['stack']) {
      bot.sendAlert(replaceHtml(exception['stack']), 'javascript');
    } else if (exception['_'] == 'error') {
      bot.sendAlert(JSON.stringify(exception, null, 4), 'json');
    } else {
      bot.sendAlert(exception.message, 'json');
    }
    if (message) {
      bot.replyMessage(message, bot.errors.exceptionFound);
    }
  }
  return exception;
};

export const tagForBotRegExp = /@(\\w+):/gim;
export const telegramLinkRegExp = new RegExp('(?:t|telegram|tlgrm).(?:me|dog)/(joinchat/)?([a-zA-Z0-9-+_]+)', 'gim');
export const linkRegExp =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gim;

export const t = {
  second: 1,
  minute: 60,
  hour: 60 * 60,
  day: 60 * 60 * 24,
  week: 60 * 60 * 24 * 7,
  month: 60 * 60 * 24 * 30,
  year: 60 * 60 * 24 * 365,
};

export const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
};

export const formatTimeInSeconds = (seconds: number, dayString = 'day', daysString = 'days'): string => {
  const days = Math.floor(seconds / t.day);
  seconds = seconds - days * t.day;
  const hours = Math.floor(seconds / t.hour);
  seconds = seconds - hours * t.hour;
  const minutes = Math.floor(seconds / t.minute);
  seconds = Math.round(seconds - minutes * t.minute);
  let text = '';
  if (days > 0 && days <= 9) {
    if (days > 1) {
      text += `${days} ${daysString}, `;
    } else {
      text += `${days} ${dayString}, `;
    }
  }
  if (hours <= 9) {
    text += '0';
  }
  text += `${hours}:`;
  if (minutes <= 9) {
    text += '0';
  }
  text += `${minutes}:`;
  if (seconds <= 9) {
    text += '0';
  }
  text += `${seconds}`;
  return text;
};

export const loggerFormat = winstonFormat.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message} `;
  if (metadata && Object.keys(metadata).length > 0) {
    msg += JSON.stringify(metadata);
  }
  return msg;
});

export const transport = new winston.transports.DailyRotateFile({
  dirname: 'logs',
  filename: 'polaris-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d',
});

// Configure logger
export const logger = createLogger({
  level: 'info',
  format: winstonFormat.combine(winstonFormat.timestamp(), winstonFormat.json()),
  transports: [
    new transports.Console({
      format: winstonFormat.combine(
        winstonFormat.colorize(),
        winstonFormat.timestamp({
          format: 'HH:mm:ss',
        }),
        loggerFormat,
      ),
    }),
    transport,
  ],
});

export const execResult = async (command: string): Promise<string> => {
  try {
    const { stdout } = await util.promisify(exec)(command);
    return stdout;
  } catch (e) {
    catchException(e);
    return e.message;
  }
};

export const systemName = (): string => {
  return `${os.type()} ${os.platform()} ${os.arch()}`;
};

export const systemVersion = (): string => {
  return os.version();
};

export const getMessageIcon = (type: string): string => {
  if (type == 'text') {
    return '🗨️';
  } else if (type == 'photo') {
    return '🖼️';
  } else if (type == 'voice') {
    return '🎵';
  } else if (type == 'audio') {
    return '🎶';
  } else if (type == 'video') {
    return '🎥';
  } else if (type == 'animation') {
    return '🎬';
  } else if (type == 'document') {
    return '📦';
  } else if (type == 'sticker') {
    return '🎭';
  } else if (type == 'unsupported') {
    return '⚠️';
  }
  return type;
};
