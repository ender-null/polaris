import FormData from 'form-data';
import format from 'string-format';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import {
  btoa,
  capitalize,
  capitalizeEachWord,
  formatNumber,
  generateCommandHelp,
  getInput,
  getTags,
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
        command: '/worldofwarcraft',
        aliases: ['/wow'],
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
      statistics: 'Statistics',
      health: 'Health',
      strength: 'Strength',
      agility: 'Agility',
      intellect: 'Intellect',
      stamina: 'Stamina',
      armor: 'Armor',
      achievementPoints: 'Achievement points',
      honorLevel: 'Honor level',
      honorableKills: 'Honorable kills',
      herbalism: 'Herbalism',
      mining: 'Mining',
      skinning: 'Skinning',
      fishing: 'Fishing',
      alchemy: 'Alchemy',
      blacksmithing: 'Blacksmithing',
      enchanting: 'Enchanting',
      engineering: 'Engineering',
      inscription: 'Inscription',
      jewelcrafting: 'Jewelcrafting',
      leatherworking: 'Leatherworking',
      tailoring: 'Tailoring',
      mythicPlusScores: 'Raider.io Mythic+ scores',
      dps: 'DPS',
      healer: 'Healer',
      tank: 'Tank',
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
    const uid = String(msg.sender.id);

    // Get character data
    if (isCommand(this, 1, msg.content)) {
      let region = 'eu';
      let realm = null;
      let characterName = null;

      if (!input) {
        const tags = getTags(this.bot, uid, 'wow:?');
        if (tags && tags.length > 0) {
          const characterInfo = tags[0].split(':')[1];
          if (characterInfo.indexOf('/') > -1) {
            const split = characterInfo.split('/');
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
        characterName = words.pop().toLowerCase();
        realm = words.join('-').toLowerCase();
      }
      const [character, media, raids, pvp, professions, statistics, raiderIO] = await Promise.all([
        this.getCharacter(region, realm, characterName),
        this.getCharacterMedia(region, realm, characterName),
        this.getCharacterRaids(region, realm, characterName),
        this.getCharacterPVP(region, realm, characterName),
        this.getCharacterProfessions(region, realm, characterName),
        this.getCharacterStatistics(region, realm, characterName),
        this.getRaiderIO(region, realm, characterName),
      ]);
      if (!character || !media || !raids || !pvp || !professions) {
        this.accessToken = await this.retrievingAccessToken();
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
      if (character.code == 404) {
        return this.bot.replyMessage(msg, this.bot.errors.noResults);
      }
      let title = null;
      if (character.active_title) {
        title = character.active_title.display_string.replace('{name}', character.name);
      }
      const name = `${character.name}-${character.realm.name} (${this.strings.lv}: ${character.level})`;
      let guild = null;
      if ('guild' in character) {
        if (character.realm.name == character.guild.realm.name) {
          guild = `<${character.guild.name}>`;
        } else {
          guild = `<${character.guild.name}-${character.guild.realm.name}>`;
        }
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
      const stats = format(
        `${this.strings['statistics']}:\n\t${this.strings['health']}: {0} \n\t{1}: {2}\n\t${this.strings[mainStat]}: {3}\n\t${this.strings['stamina']}: {4}\n\t${this.strings['armor']}: {5}`,
        formatNumber(statistics.health),
        statistics.power_type.name,
        formatNumber(statistics.power),
        formatNumber(mainStatAmount),
        formatNumber(statistics.stamina.effective),
        formatNumber(statistics.armor.effective),
      );
      const characterClass = `${character.character_class.name} ${character.active_spec.name}`;
      const race = `${character.race.name} ${character.gender.type == 'FEMALE' ? '♀️' : '♂️'}`;
      const info = format(
        `${this.strings.achievementPoints}: {0} \n${this.strings.ilvl}: {1}\n${this.strings.honorLevel}: {2}\n${this.strings.honorableKills}: {3}`,
        formatNumber(character.achievement_points),
        character.average_item_level,
        pvp.honor_level,
        formatNumber(pvp.honorable_kills),
      );
      let professionLevels = null;
      if (professions.primaries) {
        professionLevels = '';
        professions.primaries.map((profession) => {
          let highest;
          profession.tiers.map((tier) => {
            if (!highest || tier.tier.id > highest.tier.id) {
              highest = tier;
            }
          });
          if (professions.primaries.indexOf(profession) > 0) {
            professionLevels += '\n';
          }
          professionLevels += `${this.strings[profession.profession.name.toLowerCase()]}: ${highest.skill_points}/${
            highest.max_skill_points
          }`;
        });
      }
      let raidProgression = null;
      if (raids.expansions) {
        const lastExp = raids.expansions[raids.expansions.length - 1];
        const lastRaid = lastExp.instances[lastExp.instances.length - 1];
        raidProgression = `${lastRaid.instance.name}:`;
        lastRaid.modes.map((mode) => {
          raidProgression += `\n\t${mode.difficulty.name}: ${mode.progress.completed_count}/${mode.progress.total_count}`;
        });
      }
      let mythicScore = null;
      if (raiderIO && raiderIO.mythic_plus_scores_by_season && raiderIO.mythic_plus_scores_by_season.length > 0) {
        const lastSeason = raiderIO.mythic_plus_scores_by_season[0];
        mythicScore = `${this.strings['mythicPlusScores']}:`;
        let empty = true;
        const scores = ['dps', 'healer', 'tank'];
        scores.map((score) => {
          mythicScore += `\n\t${this.strings[score]}: ${lastSeason.scores[score]}`;
          if (lastSeason.scores[score] > 0) {
            empty = false;
          }
        });
        if (empty) {
          mythicScore = '';
        }
      }
      if (mythicScore.length == 0) {
        mythicScore = null;
      }
      let asset = media.assets.find((asset) => asset.key === 'main');
      if (!asset) {
        asset = media.assets.find((asset) => asset.key === 'inset');
      }
      if (!asset) {
        asset = media.assets.find((asset) => asset.key === 'avatar');
      }
      const photo = `${asset.value}?update=${Math.trunc(now() / 3600)}`;
      text = `${title ? title + '\n\t' : ''}${name}\n${
        guild ? guild + '\n\n' : ''
      }${characterClass}\n\t${race}\n\n${info}\n\n${stats}\n\n${professionLevels ? professionLevels + '\n\n' : ''}${
        mythicScore ? mythicScore + '\n\n' : ''
      }${raidProgression ? raidProgression + '\n\n' : ''}`;
      if (photo) {
        return this.bot.replyMessage(msg, photo, 'photo', null, { caption: text });
      }
    } else if (isCommand(this, 2, msg.content)) {
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      } else {
        const words = input.split(' ');
        const characterName = words.pop().toLowerCase();
        const realm = words.join('-').toLowerCase();
        setTag(this.bot, uid, `wow:${realm}/${characterName}`);
        text = format(
          this.strings.characterSet,
          capitalize(characterName),
          capitalizeEachWord(realm.replace(new RegExp('-', 'gim'), ' ')),
          this.bot.config.prefix,
        );
      }
    } else if (isCommand(this, 3, msg.content)) {
      const url = 'https://wowtokenprices.com/current_prices.json';
      const resp = await sendRequest(url);
      if (!resp) {
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
      const content = (await resp.json()) as any;
      if (content) {
        text = `<b>${this.strings.tokenTitle}</b>:`;
        Object.keys(content).map((region) => {
          text += format(
            '\n\t<b>{0}</b>: {1}k💰 {2}k📈{2}k',
            region.toUpperCase(),
            Math.trunc(content[region].current_price / 1000),
            Math.trunc(content[region]['1_day_low'] / 1000),
            Math.trunc(content[region]['1_day_high'] / 1000),
          );
        });
      } else {
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
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
    const resp = await sendRequest('https://eu.battle.net/oauth/token', {}, headers, body, true, this.bot);
    if (!resp) {
      return null;
    } else {
      const content = (await resp.json()) as any;
      return content.access_token;
    }
  }

  async getCharacter(region: string, realm: string, characterName: string, method = ''): Promise<any> {
    const url = `https://${region}.api.blizzard.com/profile/wow/character/${realm}/${characterName}${method}`;
    const params = {
      namespace: `profile-${region}`,
      locale: this.bot.config.locale || 'en_US',
      access_token: this.accessToken,
    };
    const resp = await sendRequest(url, params, null, null, false, this.bot);
    if (!resp) {
      return null;
    } else {
      const content = await resp.text();
      try {
        return JSON.parse(content);
      } catch (e) {
        return null;
      }
    }
  }

  async getCharacterMedia(region: string, realm: string, characterName: string): Promise<any> {
    return await this.getCharacter(region, realm, characterName, '/character-media');
  }

  async getCharacterRaids(region: string, realm: string, characterName: string): Promise<any> {
    return await this.getCharacter(region, realm, characterName, '/encounters/raids');
  }

  async getCharacterPVP(region: string, realm: string, characterName: string): Promise<any> {
    return await this.getCharacter(region, realm, characterName, '/pvp-summary');
  }

  async getCharacterStatistics(region: string, realm: string, characterName: string): Promise<any> {
    return await this.getCharacter(region, realm, characterName, '/statistics');
  }

  async getCharacterProfessions(region: string, realm: string, characterName: string): Promise<any> {
    return await this.getCharacter(region, realm, characterName, '/professions');
  }

  async getRaiderIO(region: string, realm: string, characterName: string): Promise<any> {
    const url = 'https://raider.io/api/v1/characters/profile';
    const params = {
      region: region,
      realm: realm,
      name: characterName,
      fields: 'mythic_plus_scores_by_season:current,mythic_plus_scores_by_season:previous',
    };
    const resp = await sendRequest(url, params, null, null, false, this.bot);
    if (!resp) {
      return null;
    }
    return (await resp.json()) as any;
  }
}
