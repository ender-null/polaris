/* eslint-disable @typescript-eslint/no-explicit-any */
import { Response } from 'node-fetch';
import format from 'string-format';

import { PluginBase } from '../plugin';
import {
  allButNWord,
  capitalize,
  formatNumber,
  generateCommandHelp,
  getInput,
  getTags,
  getWord,
  isCommand,
  sendRequest,
  setTag,
} from '../utils';
import { Bot } from '../bot';
import { iStringNested, iString, Message } from '../types';

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
        command: '/leagueoflegends',
        aliases: ['/lol'],
        parameters: [
          {
            name: 'riot id',
            required: false,
          },
        ],
        description: 'Show summoner stats',
      },
      {
        command: '/lolset',
        parameters: [
          {
            name: 'riot id',
            required: true,
          },
        ],
        description: 'Set Riot ID',
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
      summonerSet: 'Your summoner is set as <b>{0}</b>, you can now just use {2}lol',
    };
    this.baseUrl = 'api.riotgames.com';
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg);
    let text;
    const uid = String(msg.sender.id);

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
      let riotId = null;

      this.region = this.regions['euw'];

      if (!input) {
        const tags = await getTags(this.bot, uid, 'riot:?');
        if (tags && tags.length > 0) {
          riotId = tags[0].split(':')[1];
        }
        if (!riotId) {
          return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
        }
      } else {
        riotId = input;
      }
      const [gameName, tagLine] = riotId.split('#');
      const account = await this.accountByRiotId(gameName, tagLine);
      const summoner = await this.summonerByPUUID(account['puuid']);
      if (!summoner || ('status' in summoner && summoner['status']['status_code'] != 200)) {
        return this.bot.replyMessage(msg, this.bot.errors.connectionError);
      }
      const [masteries, ranked] = await Promise.all([
        this.championMasteries(account['puuid']),
        this.leagueEntries(summoner['id']),
      ]);
      let iconUrl = null;
      if (this.latestVersion) {
        iconUrl = format(
          'https://ddragon.leagueoflegends.com/cdn/{0}/img/profileicon/{1}.png',
          this.latestVersion,
          summoner['profileIconId'],
        );
      }
      text = format('{0} ({1}: {2})\n', summoner['name'], this.strings['lv'], summoner['summonerLevel']);
      if (masteries) {
        text += `\n${this.strings.masteries}:`;
        let limit = 5;
        Object.keys(masteries).map((i) => {
          const mastery = masteries[i];
          text += format(
            '\n\t{0}: {1} {2} ({3})',
            this.championIds[String(mastery['championId'])],
            this.strings.lv,
            mastery['championLevel'],
            formatNumber(mastery['championPoints']),
          );
          limit -= 1;
          if (limit == 0) {
            return;
          }
        });
      }
      if (ranked) {
        Object.keys(ranked).map((i) => {
          const queue = ranked[i];
          text += format(
            '\n\n{0}:\n\t{1}: {2} {3} ({4}{5})',
            this.rankedQueueType(queue['queueType']),
            this.strings.league,
            this.rankedTier(queue['tier']),
            queue['rank'],
            queue['leaguePoints'],
            this.strings.lp,
          );
          text += format(
            '\n\t{0}/{1}: {2} / {3} ({4}%)',
            this.strings.wins,
            this.strings.losses,
            queue['wins'],
            queue['losses'],
            (Math.round((queue['wins'] / (queue['wins'] + queue['losses'])) * 100) * 10) / 10,
          );
        });
      }

      if (iconUrl) {
        return this.bot.replyMessage(msg, iconUrl, 'photo', null, { caption: text, format: 'HTML', preview: true });
      }
    } else if (isCommand(this, 2, msg.content)) {
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      } else {
        const riotId = input;
        setTag(this.bot, uid, `riot:${riotId}`);
        text = format(this.strings.summonerSet, riotId.replace(new RegExp('_', 'gim'), ' '), this.bot.config.prefix);
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
    const resp = await sendRequest(endpoint + method, {}, headers, null, false, this.bot);
    const content = (await resp.json()) as any;
    return content;
  }

  async accountByRiotId(gameName: string, tagLine: string): Promise<Response> {
    return await this.apiRequest(`/riot/account/v1/accounts/by-riot-id/${gameName}/${tagLine}`, true);
  }

  async summonerByPUUID(puuid: string): Promise<Response> {
    return await this.apiRequest(`/lol/summoner/v4/summoners/by-puuid/${puuid}`);
  }

  async championMasteries(puuid: string): Promise<Response> {
    return await this.apiRequest(`/lol/champion-mastery/v4/champion-masteries/by-puuid/${puuid}`);
  }

  async leagueEntries(puuid: string): Promise<Response> {
    return await this.apiRequest(`/lol/league/v4/entries/by-by-puuid/${puuid}`);
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
      `https://ddragon.leagueoflegends.com/cdn/${this.latestVersion}/data/${this.bot.config.locale}/champion.json`,
    );
    if (data) {
      const champions = await data.json();
      return champions['data'];
    }
    return null;
  }

  rankedQueueType(queueType: string): string {
    if (queueType == 'RANKED_FLEX_SR') {
      return this.strings.rankedFlex;
    } else if (queueType == 'RANKED_SOLO_5x5') {
      return this.strings.rankedSolo;
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
      Object.keys(this.champions).map((champ) => {
        championIds[this.champions[champ]['key']] = this.champions[champ]['name'];
      });
    }
    return championIds;
  }
}
