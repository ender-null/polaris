import { Response } from 'node-fetch';
import format from 'string-format';
import { Bot, iString, iStringNested, Message } from '..';
import { PluginBase } from '../plugin';
import {
  allButNWord,
  capitalize,
  delTag,
  generateCommandHelp,
  getInput,
  getTags,
  getWord,
  hasTag,
  isCommand,
  sendRequest,
  setTag,
} from '../utils';

export class LeagueOfLegendsPlugin extends PluginBase {
  baseUrl: string;
  regions: iStringNested;
  region: iString;
  latestVersion: string;
  champions: iStringNested;
  championIds: iString;
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/lol',
        parameters: [
          {
            name: 'region',
            required: false,
          },
          {
            name: 'summoner name',
            required: false,
          },
        ],
        description: 'Show summoner stats',
      },
      {
        command: '/lolset',
        parameters: [
          {
            name: 'region',
            required: true,
          },
          {
            name: 'summoner name',
            required: true,
          },
        ],
        description: 'Set summoner name and region',
      },
    ];
    this.strings = {
      lv: 'Lv',
      masteries: 'Masteries',
      league: 'League',
      rankedSolo: 'Ranked Solo/Duo',
      rankedFlex: 'Ranked Flex',
      wins: 'Wins',
      losses: 'Losses',
      lp: 'LP',
      invalidRegion: 'Invalid LoL region',
      summonerSet: 'Your summoner is set as <b>{0}</b> from region <b>{1}</b>, you can now just use {2}lol',
    };
    this.baseUrl = 'api.riotgames.com';
    this.regions = {
      euw: {
        platform: 'euw1',
        region: 'europe',
      },
      eune: {
        platform: 'eun1',
        region: 'europe',
      },
      tr: {
        platform: 'tr1',
        region: 'europe',
      },
      na: {
        platform: 'na1',
        region: 'americas',
      },
      lan: {
        platform: 'la1',
        region: 'americas',
      },
      las: {
        platform: 'la2',
        region: 'americas',
      },
      br: {
        platform: 'br1',
        region: 'americas',
      },
      ru: {
        platform: 'ru',
        region: 'asia',
      },
      jp: {
        platform: 'jp1',
        region: 'asia',
      },
      kr: {
        platform: 'kr',
        region: 'asia',
      },
      oce: {
        platform: 'oc1',
        region: 'asia',
      },
    };
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg);
    let text;
    let uid;
    if (msg.reply) {
      uid = String(msg.reply.sender.id);
    } else {
      uid = String(msg.sender.id);
    }
    // Get character data
    if (isCommand(this, 1, msg.content)) {
      if (!this.latestVersion) {
        this.latestVersion = await this.ddragonVersions();
      }
      if (!this.champions) {
        this.champions = await this.ddragonChampions();
      }
      if (!this.championIds) {
        this.championIds = await this.generateChampionIds();
      }
      let summonerName = null;

      this.region = this.regions['euw'];

      if (!input) {
        const tags = getTags(this.bot, uid, 'lol:?');
        if (tags && tags.length > 0) {
          const summonerInfo = tags[0].split(':')[1];
          if (summonerInfo.indexOf('/') > -1) {
            this.region = this.regions[summonerInfo.split('/')[0]];
            summonerName = summonerInfo.split('/')[1].replace(new RegExp('_', 'gim'), ' ');
          }
        }
        if (!summonerName) {
          return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
        }
      } else {
        if (getWord(input, 1).toLowerCase() in this.regions) {
          this.region = this.regions[getWord(input, 1).toLowerCase()];
          summonerName = allButNWord(input, 1);
        } else {
          this.region = this.regions['euw'];
          summonerName = input;
        }
      }
      const summoner = await this.summonerByName(summonerName);
      if (!summoner || ('status' in summoner && summoner['status']['status_code'] != 200)) {
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
      const account = await this.accountByPuuid(summoner['puuid']);
      const masteries = await this.championMasteries(summoner['id']);
      const ranked = await this.leagueEntries(summoner['id']);
      let iconUrl = null;
      if (this.latestVersion) {
        iconUrl = format(
          'http://ddragon.leagueoflegends.com/cdn/{0}/img/profileicon/{1}.png',
          this.latestVersion,
          summoner['profileIconId'],
        );
      }
      text = format('{0} ({1}: {2})\n', summoner['name'], this.strings['lv'], summoner['summonerLevel']);
      if (account && 'gameName' in account) {
        text += `${account['gameName']}#${account['tagLine']}\n`;
      }
      if (masteries) {
        text += `\n${this.strings['masteries']}:`;
        let limit = 5;
        for (const i in Object.keys(masteries)) {
          const mastery = masteries[i];
          text += format(
            '\n\t{0}: {1} {2} ({3}k)',
            this.championIds[String(mastery['championId'])],
            this.strings['lv'],
            mastery['championLevel'],
            String(mastery['championPoints'] / 1000).split('.')[0],
          );
          limit -= 1;
          if (limit == 0) {
            break;
          }
        }
      }
      if (ranked) {
        for (const i in ranked) {
          const queue = ranked[i];
          text += format(
            '\n\n{0}:\n\t{1}: {2} {3} ({4}{5})',
            this.rankedQueueType(queue['queueType']),
            this.strings['league'],
            this.rankedTier(queue['tier']),
            queue['rank'],
            queue['leaguePoints'],
            this.strings['lp'],
          );
          text += format(
            '\n\t{0}/{1}: {2} / {3} ({4}%)',
            this.strings['wins'],
            this.strings['losses'],
            queue['wins'],
            queue['losses'],
            (Math.round((queue['wins'] / (queue['wins'] + queue['losses'])) * 100) * 10) / 10,
          );
        }
      }

      if (iconUrl) {
        return this.bot.replyMessage(msg, iconUrl, 'photo', null, { caption: text, format: 'HTML', preview: true });
      }
    } else if (isCommand(this, 2, msg.content)) {
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      } else {
        if (hasTag(this.bot, uid, 'lol:?')) {
          delTag(this.bot, uid, 'lol:?');
        }
        const region = getWord(input, 1).toLowerCase();
        if (!(region in this.regions)) {
          return this.bot.replyMessage(msg, this.strings['invalidRegion']);
        }
        const summonerName = allButNWord(input, 1).replace(new RegExp(' ', 'gim'), '_');
        setTag(this.bot, uid, `lol:${region}/${summonerName}`);
        text = format(
          this.strings['summonerSet'],
          summonerName.replace(new RegExp('_', 'gim'), ' '),
          region.toUpperCase(),
          this.bot.config.prefix,
        );
      }
    }

    this.bot.replyMessage(msg, text);
  }

  async apiRequest(method: string, regional = false): Promise<Response> {
    let endpoint;
    if (regional) {
      endpoint = `https://${this.region['region']}.${this.baseUrl}`;
    } else {
      endpoint = `https://${this.region['platform']}.${this.baseUrl}`;
    }

    const headers = {
      'X-Riot-Token': this.bot.config.apiKeys.riotApi,
    };
    const resp = await sendRequest(endpoint + method, {}, headers);
    const content = await resp.json();
    return content;
  }

  async summonerByName(summonerName: string): Promise<Response> {
    return await this.apiRequest(`/lol/summoner/v4/summoners/by-name/${summonerName}`);
  }

  async accountByPuuid(puuid: string): Promise<Response> {
    return await this.apiRequest(`/riot/account/v1/accounts/by-puuid/${puuid}`, true);
  }

  async championMasteries(encryptedSummonerId: string): Promise<Response> {
    return await this.apiRequest(`/lol/champion-mastery/v4/champion-masteries/by-summoner/${encryptedSummonerId}`);
  }

  async leagueEntries(encryptedSummonerId: string): Promise<Response> {
    return await this.apiRequest(`/lol/league/v4/entries/by-summoner/${encryptedSummonerId}`);
  }

  async ddragonVersions(): Promise<string> {
    const data = await sendRequest(`https://ddragon.leagueoflegends.com/api/versions.json`);
    if (data) {
      const versions = await data.json();
      return versions[0];
    }

    return null;
  }

  async ddragonChampions(): Promise<iStringNested> {
    if (!this.latestVersion) {
      this.latestVersion = await this.ddragonVersions();
    }
    const data = await sendRequest(
      `http://ddragon.leagueoflegends.com/cdn/${this.latestVersion}/data/${this.bot.config.locale}/champion.json`,
    );
    if (data) {
      const champions = await data.json();
      return champions['data'];
    }
    return null;
  }

  rankedQueueType(queueType: string): string {
    if (queueType == 'RANKED_FLEX_SR') {
      return this.strings['rankedFlex'];
    } else if (queueType == 'RANKED_SOLO_5x5') {
      return this.strings['rankedSolo'];
    } else {
      return queueType;
    }
  }

  rankedTier(tier: string): string {
    if (tier.toLowerCase() in this.strings) {
      return this.strings[tier.toLowerCase()];
    }
    return capitalize(tier);
  }

  generateChampionIds(): iString {
    const championIds = {};
    if (this.champions) {
      for (const champ of Object.keys(this.champions)) {
        championIds[this.champions[champ]['key']] = this.champions[champ]['name'];
      }
    }
    return championIds;
  }
}
