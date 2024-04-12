/* eslint-disable @typescript-eslint/no-explicit-any */
import * as cheerio from 'cheerio';
import format from 'string-format';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { iStringNested } from '../types';
import {
  camelCase,
  formatNumber,
  generateCommandHelp,
  getInput,
  isCommand,
  logger,
  now,
  sendRequest,
  t,
} from '../utils';

export class Covid19Plugin extends PluginBase {
  countryCodes: iStringNested;
  data: iStringNested;
  dataSource: string;
  lastUpdate: number;

  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/covid',
        parameters: [
          {
            name: 'country',
            required: true,
          },
        ],
        description: 'Get current COVID-19 situation by country',
      },
      {
        command: '/covidlist',
        description: 'Return list of countries with COVID-19 data',
      },
    ];
    this.strings = {
      countryList: 'Most affected countries codes',
      moreCountries: 'Showing only the most affected countries, but you can try other codes and names',
      countrySituation: 'COVID-19 situation in {0}',
      dataSource: 'Source',
      deaths: 'Deaths',
      deathsLast24Hours: 'Newly reported deaths',
      deathsLast7Days: 'Deaths in last 7 days',
      deathsPerMillion: 'Deaths per million',
      cases: 'Cases',
      casesLast24Hours: 'Newly reported cases',
      casesLast7Days: 'Cases in last 7 days',
      casesPerMillion: 'Cases per million',
    };

    this.dataSource = 'https://covid19.who.int/table';
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (isCommand(this, 2, msg.content) || input) {
      if (!this.data || !this.lastUpdate || this.lastUpdate < now() - 3 * t.hour) {
        const update = await this.update();
        if (!update) {
          return this.bot.replyMessage(msg, this.bot.errors.connectionError);
        }
      }
    }

    let text = '';
    if (isCommand(this, 1, msg.content)) {
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      } else {
        const countryCode = this.findCountryCode(input);
        if (!countryCode || (countryCode && this.data[countryCode] == undefined)) {
          return this.bot.replyMessage(msg, this.bot.errors.noResults);
        } else {
          text = `<b>${format(this.strings['countrySituation'], this.countryCodes[countryCode].name)}</b>:`;
          const values = [
            'cases',
            'casesLast7Days',
            'casesLast24Hours',
            'casesPerMillion',
            'deaths',
            'deathsLast7Days',
            'deathsLast24Hours',
            'deathsPerMillion',
          ];
          const separator = 4;
          for (const value of values) {
            const tab = values.indexOf(value) != 0 && values.indexOf(value) != separator;
            if (values.indexOf(value) == separator) {
              text += '\n';
            }
            text += `\n${tab ? '\t' : ''}${this.strings[value]}: <b>${formatNumber(this.data[countryCode][value])}</b>`;
          }
          text += `\n\n<a href="${this.dataSource}">${this.strings['dataSource']}</a>`;
        }
      }
    } else if (isCommand(this, 2, msg.content)) {
      text = `<i>${this.strings['moreCountries']}</i>`;
      text += `\n\n<b>${this.strings['countryList']}</b>:`;
      let limit = 50;
      for (const code in this.data) {
        text += `\n\t<code>${code}</code>: ${this.countryCodes[code].name}`;
        limit -= 1;
        if (limit == 0) {
          break;
        }
      }
    }
    this.bot.replyMessage(msg, text);
  }

  async update(): Promise<boolean> {
    logger.info('Updating COVID-19 data');
    if (!this.countryCodes) {
      const countryCodes = await this.getCountryCodes();
      if (!countryCodes) {
        return false;
      }
    }
    const resp = await sendRequest(
      'https://covid19.who.int/page-data/table/page-data.json',
      null,
      null,
      null,
      false,
      this.bot,
    );
    if (!resp) {
      return false;
    }
    const content = (await resp.json()) as any;
    const countryGroups = content.result.pageContext.countryGroups;
    this.data = {};
    countryGroups.map((country) => {
      const code = country.value.toLowerCase();
      const lastEntry = country.data.rows[country.data.rows.length - 1];
      this.data[code] = {};
      for (let i = 0; i < country.data.metrics.length; i++) {
        this.data[code][camelCase(country.data.metrics[i].name)] = country.data.totals[i];
      }
      this.data[code] = {
        ...this.data[code],
        ...{
          cases: lastEntry[8],
          casesPerMillion: lastEntry[11],
          casesLast7Days: lastEntry[9],
          casesLast24Hours: lastEntry[7],
          deaths: lastEntry[3],
          deathsPerMillion: lastEntry[6],
          deathsLast7Days: lastEntry[4],
          deathsLast24Hours: lastEntry[2],
        },
      };
    });
    this.lastUpdate = now();
    logger.info('Updated COVID-19 data');
    return true;
  }

  async getCountryCodes(): Promise<boolean> {
    const resp = await sendRequest('https://www.iban.com/country-codes', null, null, null, false, this.bot);
    if (!resp) {
      return false;
    }
    const html = await resp.text();
    const $ = cheerio.load(html);
    const table = $('tbody');
    const rows = table.find('tr');
    this.countryCodes = {};
    rows.each((index) => {
      const fullName = rows.eq(index).find('td').eq(0).text();
      const name = fullName
        .replace(new RegExp(' [\\(\\[].*?[\\)\\]]', 'gim'), '')
        .replace(new RegExp(', [sS]+', 'gim'), '');
      const code = rows.eq(index).find('td').eq(1).text().toLowerCase();
      const code2 = rows.eq(index).find('td').eq(2).text().toLowerCase();
      this.countryCodes[code] = {
        fullName: name,
        name: name,
        code: code,
        code2: code2,
      };
    });
    return true;
  }

  findCountryCode(name: string): string {
    const regex = new RegExp(name, 'gim');
    for (const i in this.countryCodes) {
      const country = this.countryCodes[i];
      if (name.length == 2) {
        if (regex.test(country.code)) {
          return country.code;
        }
      } else if (name.length == 3) {
        if (regex.test(country.code2)) {
          return country.code;
        }
      } else {
        if (regex.test(country.name) || regex.test(country.fullName)) {
          return country.code;
        }
      }
    }
    return null;
  }
}
