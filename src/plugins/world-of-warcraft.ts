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
      {
        command: '/wowtoken',
        description: 'Get WoW Token prices',
      },
    ];
    this.strings = {
      lv: 'Lv',
      ilvl: 'Item level',
      health: 'Health',
      strength: 'Strength',
      agility: 'Agility',
      intellect: 'Intellect',
      stamina: 'Stamina',
      armor: 'Armor',
      achievementPoints: 'Achievement points',
      honorLevel: 'Honor level',
      honorableKills: 'Honorable kills',
      characterSet: 'Your character is set as <b>{0}</b> from realm <b>{1}</b>, you can now just use {2}wow',
      tokenTitle: 'WoW token price',
    };
  }
  async run(msg: Message): Promise<void> {
    if (!this.accessToken) {
      this.accessToken = await this.retrievingAccessToken();
    }
    const input = getInput(msg, false);
    let text = '';
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
      const pvp = await this.getCharacterPVP(region, realm, characterName);
      const statistics = await this.getCharacterStatistics(region, realm, characterName);

      if (character.code == 404) {
        return this.bot.replyMessage(msg, this.bot.errors.noResults);
      }
      let title = null;
      if (character.active_title) {
        title = character.active_title.display_string.replace('{name}', character.name);
      }
      const name = `${character.name}-${character.realm.name} (${this.strings['lv']}: ${character.level})`;
      let guild = null;
      if ('guild' in character) {
        guild = `<${character.guild.name}-${character.guild.realm.name}>`;
      }
      let mainStat = 'strength';
      let mainStatAmount = statistics.strength.effective;
      if (statistics.agility.effective > mainStatAmount) {
        mainStat = 'agility';
        mainStatAmount = statistics.agility.effective;
      }
      if (statistics.intellect.effective > mainStatAmount) {
        mainStat = 'intellect';
        mainStatAmount = statistics.intellect.effective;
      }
      const characterClass = `${character.character_class.name} ${character.active_spec.name}`;
      const race = `${character.race.name} ${character.gender.type == 'FEMALE' ? '♀️' : '♂️'}`;
      const stats = format(
        `${this.strings['health']}: {0} \n{1}: {2}\n\t${this.strings[mainStat]}: {3}\n\t${this.strings['stamina']}: {4}\n\t${this.strings['armor']}: {5}`,
        statistics.health,
        statistics.power_type.name,
        statistics.power,
        mainStatAmount,
        statistics.stamina.effective,
        statistics.armor.effective,
      );
      const info = format(
        `${this.strings['achievementPoints']}: {0} \n${this.strings['ilvl']}: {1}\n${this.strings['honorLevel']}: {2}\n${this.strings['honorableKills']}: {3}`,
        character.achievement_points,
        character.average_item_level,
        pvp.honor_level,
        pvp.honorable_kills,
      );
      if (title) {
        text += `${title}\n\t`;
      }
      if (guild) {
        text += `${name}\n${guild}\n\t${characterClass}\n\t${race}\n\n${stats}\n\n${info}`;
      } else {
        text += `${name}\n${characterClass}\n${race}\n\n${stats}\n\n${info}`;
      }

      const lastExp = raids.expansions[raids.expansions.length - 1];
      const lastRaid = lastExp.instances[lastExp.instances.length - 1];
      let raidProgression = `${lastRaid.instance.name}:`;
      for (const mode of lastRaid.modes) {
        raidProgression += `\n\t${mode.difficulty.name}: ${mode.progress.completed_count}/${mode.progress.total_count}`;
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
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      } else {
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
    } else if (isCommand(this, 3, msg.content)) {
      const url = 'https://wowtokenprices.com/current_prices.json';
      const resp = await sendRequest(url);
      const content = await resp.json();
      if (content) {
        text = `<b>${this.strings['tokenTitle']}</b>:`;
        for (const region in content) {
          text += format(
            '\n\t<b>{0}</b>: {1}k💰 {2}k📈{2}k',
            region.toUpperCase(),
            Math.trunc(content[region].current_price / 1000),
            Math.trunc(content[region]['1_day_low'] / 1000),
            Math.trunc(content[region]['1_day_high'] / 1000),
          );
        }
      } else {
        this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
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
    const resp = await sendRequest('https://eu.battle.net/oauth/token', {}, headers, body, true);
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

  async getCharacterPVP(region: string, realm: string, characterName: string): Promise<any> {
    return await this.getCharacter(region, realm, characterName, '/pvp-summary');
  }

  async getCharacterStatistics(region: string, realm: string, characterName: string): Promise<any> {
    return await this.getCharacter(region, realm, characterName, '/statistics');
  }
}
