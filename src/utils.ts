import { exec } from 'child_process';
import fs from 'fs';
import mime from 'mime-types';
import AbortController from 'node-abort-controller';
import fetch, { BodyInit, HeadersInit, RequestInit, Response } from 'node-fetch';
import querystring, { ParsedUrlQueryInput } from 'querystring';
import { pipeline } from 'stream';
import { error } from 'tdl/types/tdlib';
import tmp from 'tmp';
import util from 'util';
import winston, { createLogger, format as winstonFormat, transports } from 'winston';
import 'winston-daily-rotate-file';
import { Bot, Message, PluginBase } from '.';
import { db } from './main';
import { CoordinatesResult, iString } from './types';

export function getPluginSlug(plugin: PluginBase) {
  return plugin.constructor.name.replace('Plugin', '').toLowerCase();
}

export function isOwner(bot: Bot, uid: number | string, msg: Message = null): boolean {
  return hasTag(bot, uid, 'owner') || msg.sender.id == bot.config.owner;
}

export async function isAdmin(bot: Bot, uid: number | string, msg: Message = null): Promise<boolean> {
  return hasTag(bot, uid, 'admin') || (await isGroupAdmin(bot, uid, msg));
}

export async function isMod(bot: Bot, uid: number | string, gid: number | string): Promise<boolean> {
  if (typeof uid != 'string') {
    uid = String(uid);
  }

  if (hasTag(bot, uid, 'globalmod') || hasTag(bot, uid, `mod:${gid}`)) {
    return true;
  } else {
    return false;
  }
}

export async function isGroupAdmin(bot: Bot, uid: number | string, msg: Message = null): Promise<boolean> {
  if (typeof uid != 'string') {
    uid = String(uid);
  }
  if (msg && +msg.conversation.id < 0) {
    const chatAdmins = await bot.getChatAdmins(msg.conversation.id);
    for (const admin of chatAdmins) {
      if (uid == String(admin.id)) return true;
    }
  }

  return false;
}

export function isTrusted(bot: Bot, uid: number | string, msg: Message = null): boolean {
  return hasTag(bot, uid, 'trusted') || isOwner(bot, uid, msg);
}

export function getTags(bot: Bot, target: number | string, tagFilter?: string): string[] {
  if (typeof target != 'string') {
    target = String(target);
  }
  if (db.tags && db.tags[target] !== undefined) {
    const tags = [];
    for (const i in db.tags[target]) {
      const tag = db.tags[target][i];
      if (tagFilter && tagFilter.indexOf('?') > -1 && !tag.startsWith(tagFilter.split('?')[0])) {
        continue;
      }
      const inputMatch = tagForBot.exec(tag);
      if (inputMatch) {
        if (inputMatch && (inputMatch[1] === bot.config.name || inputMatch[1] === bot.user.username)) {
          tags.push(tag.replace(tagForBot, ''));
        }
      } else {
        tags.push(tag);
      }
    }
    return tags;
  } else {
    return [];
  }
}

export function getTaggedWith(bot: Bot, tag: string): string[] {
  const subs = [];
  for (const gid in db.groups) {
    if (hasTag(bot, gid, tag)) {
      subs.push(gid);
    }
  }
  for (const uid in db.users) {
    if (hasTag(bot, uid, tag)) {
      subs.push(uid);
    }
  }
  return subs;
}

export function hasTag(bot: Bot, target: number | string, tag: string): boolean {
  if (typeof target != 'string') {
    target = String(target);
  }
  const tags = getTags(bot, target);
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
}

export function setTag(bot: Bot, target: number | string, tag: string): void {
  if (typeof target != 'string') {
    target = String(target);
  }
  const tags = getTags(bot, target);
  if (tags && tags.indexOf(tag) == -1) {
    let found = false;
    if (db.tags[target] && tag.indexOf(':') > -1) {
      for (const i of Object.keys(db.tags[target])) {
        const targetTag = db.tags[target][i];
        if (targetTag.startsWith(tag.split(':')[0] + ':')) {
          db.tags[target][i] = tag;
          found = true;
          break;
        }
      }
    }
    if (found == false) {
      if (db.tags[target]) {
        db.tags[target][Object.keys(db.tags[target]).length] = tag;
      } else {
        db.tags[target] = {
          0: tag,
        };
      }
    }
    db.tags[target] = sortList(db.tags[target]);
    db.tagsSnap.child(target).ref.set(sortList(db.tags[target]));
  }
}

export function delTag(bot: Bot, target: number | string, tag: string): void {
  if (typeof target != 'string') {
    target = String(target);
  }
  const tags = getTags(bot, target);
  if (tags && tag.indexOf('?') > -1) {
    for (const i of Object.keys(db.tags[target])) {
      const targetTag = db.tags[target][i];
      if (targetTag.startsWith(tag.split('?')[0])) {
        delete db.tags[target][i];
      }
    }
    db.tags[target] = sortList(db.tags[target]);
    db.tagsSnap.child(target).ref.set(db.tags[target]);
  } else if (tags && tags.indexOf(tag) > -1) {
    for (const i of Object.keys(db.tags[target])) {
      const targetTag = db.tags[target][i];
      if (targetTag == tag) {
        delete db.tags[target][i];
      }
    }
    db.tags[target] = sortList(db.tags[target]);
    db.tagsSnap.child(target).ref.set(sortList(db.tags[target]));
  }
}

export function isInt(number: number | string): boolean {
  if (typeof number == 'number') {
    return true;
  } else if (typeof number != 'string') {
    return false;
  }
  return !isNaN(parseFloat(number));
}

export function getTarget(bot: Bot, m: Message, input: string): string {
  if (m.reply) {
    return String(m.reply.sender.id);
  } else if (input) {
    const target = getWord(input, 1);
    if (target && isInt(target)) {
      return String(target);
    } else if (target && target.startsWith('@')) {
      if (bot.user.username.toLowerCase() == target.substr(1).toLowerCase()) {
        return String(bot.user.id);
      }
      for (const uid in db.users) {
        if (
          db.users[uid]['username'] !== undefined &&
          db.users[uid]['username'].toLowerCase() == target.substr(1).toLowerCase()
        ) {
          return uid;
        }
      }
      for (const gid in db.groups) {
        if (
          db.groups[gid]['username'] !== undefined &&
          db.groups[gid]['username'].toLowerCase() == target.substr(1).toLowerCase()
        ) {
          return gid;
        }
      }
    } else if (target && target.startsWith('<@')) {
      target.replace(new RegExp('<@!?([d]+)>', 'gim'), '$1');
    } else if (target && target == '-g') {
      return String(m.conversation.id);
    } else {
      for (const uid in db.users) {
        let name = '';
        if (db.users[uid].first_name !== undefined) {
          name += db.users[uid].first_name;
        }
        if (db.users[uid].last_name !== undefined) {
          name += ' ' + db.users[uid].last_name;
        }
        if (new RegExp(target, 'gim').test(name)) {
          return uid;
        }
      }
      for (const gid in db.groups) {
        if (new RegExp(target, 'gim').test(db.groups[gid].title)) {
          return gid;
        }
      }
    }
    return target;
  } else {
    return String(m.sender.id);
  }
}

export function capitalize(text: string, setLowercase?: boolean): string {
  if (text) {
    if (setLowercase) {
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    } else {
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
  }
  return null;
}

export function capitalizeEachWord(text: string): string {
  if (text) {
    if (text.indexOf(' ') > -1) {
      const words = text.split(' ');
      const capitalized = [];
      for (const word of words) {
        capitalized.push(capitalize(word));
      }
      return capitalized.join(' ');
    } else {
      return capitalize(text);
    }
  }
  return null;
}

export function camelCase(text: string): string {
  if (text) {
    return text
      .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, '');
  }
  return null;
}

export function getWord(text: string, i: number): string {
  if (text && text.indexOf(' ') > -1) {
    return text.split(' ')[i - 1];
  } else if (text && text.indexOf(' ') == -1 && i == 1) {
    return text;
  } else {
    return null;
  }
}

export function allButNWord(text: string, word = 1): string {
  if (!text || text.indexOf(' ') == -1) {
    return null;
  }
  return text.substr(text.indexOf(text.split(' ')[word]));
}

export function getUsername(uid: number | string): string {
  if (typeof uid != 'string') {
    uid = String(uid);
  }
  let name = '';
  if (db.users[uid] !== undefined) {
    if (db.users[uid]['first_name'] !== undefined) {
      name += ' ' + db.users[uid].first_name;
    }
    if (db.users[uid]['last_name'] !== undefined) {
      name += ' ' + db.users[uid].last_name;
    }
    if (db.users[uid]['username'] !== undefined && db.users[uid]['username'] !== '') {
      name = `@${db.users[uid].username}`;
    }
  } else if (db.groups[uid] !== undefined) {
    name = db.groups[uid].title;
    if (db.groups[uid]['username'] !== undefined && db.groups[uid]['username'] !== '') {
      name = `@${db.groups[uid].username}`;
    }
  } else {
    name = '[not found]';
  }
  return name;
}

export function getFullName(uid: number | string, includeUsername = true): string {
  if (typeof uid != 'string') {
    uid = String(uid);
  }
  let name = '';
  if (db.users[uid] !== undefined) {
    if (db.users[uid]['first_name'] !== undefined) {
      name += ' ' + db.users[uid].first_name;
    }
    if (db.users[uid]['last_name'] !== undefined) {
      name += ' ' + db.users[uid].last_name;
    }
    if (includeUsername && db.users[uid]['username'] !== undefined) {
      name += ` (@${db.users[uid].username})`;
    }
  } else if (db.groups[uid] !== undefined) {
    name = db.groups[uid].title;
    if (db.groups[uid]['username'] !== undefined) {
      name += ` (@${db.groups[uid].username})`;
    }
  } else {
    name = '[not found]';
  }
  return escapeMarkdown(name);
}

export function fixTelegramLink(link: string): string {
  const inputMatch = telegramLinkRegExp.exec(link);
  if (inputMatch && inputMatch.length > 0) {
    const fixedLink = `https://t.me/joinchat/${inputMatch[1]}`;
    logger.info(`Fixed Telegram link: ${fixedLink}`);
    return fixedLink;
  }
  return link;
}

export function setInput(message: Message, trigger: string): Message {
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
  if ('shortcut' in command) {
    doc += `\n\nAlias: <code>${command.shortcut.replace('/', plugin.bot.config.prefix)}</code>`;
  }

  return doc;
}

export async function sendRequest(
  url: string,
  params?: ParsedUrlQueryInput,
  headers?: HeadersInit,
  data?: BodyInit,
  post?: boolean,
  bot?: Bot,
): Promise<Response> {
  const options: RequestInit = {
    method: post ? 'POST' : 'GET',
    body: data,
    headers: headers,
    timeout: 5 * t.minute * 1000,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, options.timeout);
  try {
    const response = await fetch(`${url}?${querystring.stringify(params)}`, { ...options, signal: controller.signal });
    if (!response.ok) {
      const error = response.clone();
      const json = await error.json().catch((e) => catchException(e));
      logger.error(JSON.stringify(json));
      if (bot) {
        bot.sendAlert(JSON.stringify(json));
      }

      // if (error.status == 429) {
      //   setTimeout(async () => {
      //     await sendRequest(url, params, headers, data, post, bot);
      //   }, 10000);
      // }
    }
    return response;
  } catch (error) {
    catchException(error, bot);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function responseUrlFromRequest(
  url: string,
  params?: ParsedUrlQueryInput,
  headers?: HeadersInit,
  bot?: Bot,
): Promise<string> {
  const response = await sendRequest(url, params, headers, null, false, bot);
  if (response) {
    return response.url;
  }
  return null;
}

export async function download(
  url: string,
  params?: ParsedUrlQueryInput,
  headers?: HeadersInit,
  post?: boolean,
  bot?: Bot,
): Promise<string> {
  const response = await sendRequest(url, params, headers, null, post, bot);
  if (!response) {
    return null;
  }
  const contentType =
    response.headers.get('content-type') || response.headers.get('Content-Type') || 'application/octet-stream';
  const contentLength = response.headers.get('content-length') || response.headers.get('Content-Length') || '0';
  const tempfile = tmp.fileSync({ mode: 0o644, postfix: `.${mime.extension(contentType)}` });
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
}

export function getExtension(url: string): string {
  const filename = url.split('#').shift().split('?').shift().split('/').pop();
  if (filename.indexOf('.') > -1) {
    return `.${filename.split('.').pop()}`;
  } else {
    return '';
  }
}

export async function mp3ToOgg(input: string): Promise<string> {
  try {
    const output = tmp.fileSync({ mode: 0o644, postfix: `.ogg` });
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
}

export async function getCoords(input: string, bot?: Bot): Promise<CoordinatesResult> {
  let lang = 'en';
  let key = null;
  if (bot) {
    lang = bot.config.locale.slice(0, 2);
    key = bot.config.apiKeys.googleDeveloperConsole;
  }

  const url = 'https://maps.googleapis.com/maps/api/geocode/json';
  const params = {
    address: input,
    language: lang,
    region: lang,
    key: key,
  };
  const res = await sendRequest(url, params);
  if (res) {
    const content = await res.json();
    if (content.status != 'OK') {
      logger.error(JSON.stringify(content));
      if (bot) {
        bot.sendAlert(JSON.stringify(content));
      }
    }
    if (content && content.results.length > 0) {
      const locality = content.results[0].address_components[0].long_name;
      let country;
      for (const address of content.results[0].address_components) {
        if (address.types.indexOf('country') > -1) {
          country = address.long_name;
        }
      }
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
}

export function removeHtml(text: string): string {
  if (text) {
    text = text.replace(new RegExp('<[^<]+?>', 'gim'), '');
  }
  return text;
}

export function replaceHtml(text: string): string {
  if (text) {
    text = text.replace(new RegExp('<', 'gim'), '&lt;');
    text = text.replace(new RegExp('>', 'gim'), '&gt;');
  }
  return text;
}

export function escapeHtml(text: string): string {
  if (text) {
    text = text.replace(new RegExp('<', 'gim'), '\\<');
    text = text.replace(new RegExp('>', 'gim'), '\\>');
  }
  return text;
}

export function escapeMarkdown(text: string): string {
  if (text) {
    text = text.replace(new RegExp('[_\\*\\(\\)\\[\\]~`]', 'gim'), '\\$&');
  }
  return text;
}

export function escapeRegExp(text: string): string {
  if (text) {
    text = text.replace(new RegExp('[-\\^$*+?.()|[]{}]', 'gim'), '\\$&');
  }
  return text;
}

export function htmlToDiscordMarkdown(text: string): string {
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
    for (const rep of replacements) {
      text = text.replace(new RegExp(rep['pattern'], 'gim'), rep['sub']);
    }
    text = text.replace(new RegExp('&lt;', 'gim'), '<');
    text = text.replace(new RegExp('&gt;', 'gim'), '>');
  }
  return text;
}

export function splitLargeMessage(content: string, maxLength: number): string[] {
  const lineBreak = '\n';
  const texts = [];
  if (content) {
    const lines = content.split(lineBreak);
    let text = '';

    for (const line of lines) {
      if (text.length + line.length + lineBreak.length < maxLength) {
        text += line + lineBreak;
      } else {
        texts.push(text);
        text = line + lineBreak;
      }
    }
  }
  return texts;
}

export function formatNumber(number: string | number): string {
  if (typeof number == 'string') {
    number = parseInt(number);
  }
  return number.toLocaleString(undefined);
}

export function sortList(list: iString): iString {
  const sorted: iString = {};
  for (let i = 0; i < Object.keys(list).length; i++) {
    sorted[i] = list[Object.keys(list)[i]];
  }
  return sorted;
}

export function now(): number {
  return new Date().getTime() / 1000;
}

export function time(hour: number, minute?: number, second?: number): number {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, minute, second).getTime();
}

export function timeInRange(start: number, end: number, time: number): boolean {
  if (time >= start && time < end) {
    return true;
  }
  return false;
}

export function btoa(text: string): string {
  return Buffer.from(text).toString('base64');
}

export function random(min: number, max: number): number {
  return Math.round(Math.random() * (max - min) + min);
}

export function lstrip(str: string, strip: string): string {
  while (str[0] == strip) {
    str = str.slice(1);
  }
  return str;
}

export function rstrip(str: string, strip: string): string {
  while (str[str.length - 1] == strip) {
    str = str.slice(0, str.length - 2);
  }
  return str;
}

export function merge(base: any, extension: any): any {
  const merged = { ...base };
  for (const key of Object.keys(extension)) {
    if (base[key]) {
      if (Object.prototype.toString.call(base[key]) === '[object Object]') {
        merged[key] = this.merge(base[key], extension[key]);
      } else {
        merged[key] = extension[key];
      }
    } else {
      merged[key] = extension[key];
    }
  }
  return merged;
}

export function catchException(exception: Error | error, bot: Bot = null, message: Message = null): Error | error {
  logger.error(`Catched exception: ${exception.message}`);
  if (bot) {
    if (exception['stack']) {
      bot.sendAlert(JSON.stringify(replaceHtml(exception['stack'])));
    } else if (exception['_'] == 'error') {
      bot.sendAlert(JSON.stringify(exception));
    } else {
      bot.sendAlert(exception.message);
    }
    if (message) {
      bot.replyMessage(message, bot.errors.exceptionFound);
    }
  }
  return exception;
}

export const telegramLinkRegExp = new RegExp('(?:t|telegram|tlgrm).(?:me|dog)/joinchat/([a-zA-Z0-9-]+)', 'gim');
export const tagForBot = new RegExp('@(\\w+):', 'gim');

export const t = {
  second: 1,
  minute: 60,
  hour: 60 * 60,
  day: 60 * 60 * 24,
  week: 60 * 60 * 24 * 7,
  month: 60 * 60 * 24 * 30,
  year: 60 * 60 * 24 * 365,
};

export function dateFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toISOString();
}

export const loggerFormat = winstonFormat.printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message} `;
  if (metadata && Object.keys(metadata).length > 0) {
    msg += JSON.stringify(metadata);
  }
  return msg;
});

export const transport = new winston.transports.DailyRotateFile({
  dirname: 'logs',
  filename: 'polaris-js-%DATE%.log',
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
          format: 'Do HH:mm:ss',
        }),
        loggerFormat,
      ),
    }),
    transport,
  ],
});

export async function execResult(command: string): Promise<string> {
  try {
    const { stdout } = await util.promisify(exec)(command);
    return stdout;
  } catch (e) {
    catchException(e);
    return e.message;
  }
}
