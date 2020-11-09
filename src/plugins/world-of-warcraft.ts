import FormData from 'form-data';
import format from 'string-format';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import {
  btoa,
  capitalize,
  capitalizeEachWord,
  delTag,
  generateCommandHelp,
  getInput,
  getTags,
  hasTag,
  isCommand,
  now,
  sendRequest,
  setTag,
} from '../utils';

export class WorldOfWarcraftPlugin extends PluginBase {
  accessToken: string;
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/wow',
        parameters: [
          {
            name: 'realm',
            required: false,
          },
          {
            name: 'character name',
            required: false,
          },
        ],
        description: 'Show character stats',
      },
      {
        command: '/wowset',
        parameters: [
          {
            name: 'realm',
            required: true,
          },
          {
            name: 'character name',
            required: true,
          },
        ],
        description: 'Set character name and realm',
      },
    ];
    this.strings = {
      lv: 'Lv',
      ilvl: 'item level',
      achievementPoints: 'achievement points',
      name: '<b>{0}-{1}</b> (Nivel: {2})',
      stats: '{0} item level\n{1} achievement points',
      characterSet: 'Your character is set as <b>{0}</b> from realm <b>{1}</b>, you can now just use {2}wow',
      tokenTitle: 'WoW token price',
    };
  }
  async run(msg: Message): Promise<void> {
    if (!this.accessToken) {
      this.accessToken = await this.retrievingAccessToken();
    }
    const input = getInput(msg, false);
    let text;
    let uid;
    if (msg.reply) {
      uid = String(msg.reply.sender.id);
    } else {
      uid = String(msg.sender.id);
    }
    // Get character data
    if (isCommand(this, 1, msg.content)) {
      let region = 'eu';
      let realm = null;
      let characterName = null;

      if (!input) {
        const tags = getTags(this.bot, uid, 'wow:?');
        if (tags && tags.length > 0) {
          const summonerInfo = tags[0].split(':')[1];
          if (summonerInfo.indexOf('/') > -1) {
            const split = summonerInfo.split('/');
            realm = split[0];
            characterName = split[1];
            if (split.length > 2) {
              region = split[2];
            }
          }
        }
        if (!characterName) {
          return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
        }
      } else {
        const words = input.split(' ');
        characterName = words.pop();
        realm = words.join('-').toLowerCase();
      }
      const character = await this.getCharacter(region, realm, characterName);
      const media = await this.getCharacterMedia(region, realm, characterName);
      const raids = await this.getCharacterRaids(region, realm, characterName);

      if (character.code == 404) {
        return this.bot.replyMessage(msg, this.bot.errors.noResults);
      }
      const name = format(
        `{0}-{1} (${this.strings['lv']}: {2})`,
        character.name,
        character.realm.name,
        character.level,
      );
      let guild = null;
      if ('guild' in character) {
        guild = `<${character.guild.name}-${character.guild.realm.name}>`;
      }
      const race = `${character.race.name} ${character.character_class.name} ${
        character.gender.type == 'FEMALE' ? '♀️' : '♂️'
      }`;
      const stats = format(
        `{0} ${this.strings['ilvl']}\n{1} ${this.strings['achievementPoints']}`,
        character.average_item_level,
        character.achievement_points,
      );
      if (guild) {
        text = `${name}\n${guild}\n${race}\n\n${stats}`;
      } else {
        text = `${name}\n${race}\n\n${stats}`;
      }

      const lastExp = raids.expansions[raids.expansions.length - 1];
      const lastRaid = lastExp.instances[lastExp.instances.length - 1];
      let raidProgression = `${lastRaid.instance.name}:`;
      for (const mode of lastRaid.modes) {
        raidProgression += `\n • ${mode.difficulty.name}: ${mode.progress.completed_count}/${mode.progress.total_count}`;
      }
      let photo = null;
      for (const asset of media.assets) {
        if (asset.key == 'main') {
          photo = `${asset.value}?update=${Math.trunc(now() / 3600)}`;
          break;
        }
      }
      text += `\n\n${raidProgression}`;
      if (photo) {
        return this.bot.replyMessage(msg, photo, 'photo', null, { caption: text });
      }
    } else if (isCommand(this, 2, msg.content)) {
      if (hasTag(this.bot, uid, 'wow:?')) {
        delTag(this.bot, uid, 'wow:?');
      }
      const words = input.split(' ');
      const characterName = words.pop().toLowerCase();
      const realm = words.join('-').toLowerCase();
      setTag(this.bot, uid, `wow:${realm}/${characterName}`);
      text = format(
        this.strings['characterSet'],
        capitalize(characterName),
        capitalizeEachWord(realm.replace(new RegExp('-', 'gim'), ' ')),
        this.bot.config.prefix,
      );
    }
    this.bot.replyMessage(msg, text);
  }

  async retrievingAccessToken(): Promise<string> {
    const headers: HeadersInit = {
      Authorization: `Basic ${btoa(
        `${this.bot.config.apiKeys.blizzardClientId}:${this.bot.config.apiKeys.blizzardClientSecret}`,
      )}`,
    };
    const body = new FormData();
    body.append('grant_type', 'client_credentials');
    const resp = await sendRequest('https://eu.battle.net/oauth/token', {}, headers, body as any, true);
    const content = await resp.json();
    return content.access_token;
  }

  async getCharacter(region: string, realm: string, characterName: string, method = ''): Promise<any> {
    const url = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${characterName}${method}`;
    const params = {
      namespace: `profile-${region}`,
      locale: this.bot.config.locale,
      access_token: this.accessToken,
    };
    const resp = await sendRequest(url, params);
    return await resp.json();
  }

  async getCharacterMedia(region: string, realm: string, characterName: string): Promise<any> {
    return await this.getCharacter(region, realm, characterName, '/character-media');
  }

  async getCharacterRaids(region: string, realm: string, characterName: string): Promise<any> {
    return await this.getCharacter(region, realm, characterName, '/encounters/raids');
  }

  async getCharacterDungeons(region: string, realm: string, characterName: string): Promise<any> {
    return await this.getCharacter(region, realm, characterName, '/encounters/dungeons');
  }
}
