import * as cheerio from 'cheerio';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { iStringNested } from '../types';
import { camelCase, formatNumber, generateCommandHelp, getInput, isCommand, logger, sendRequest } from '../utils';

export class Covid19Plugin extends PluginBase {
  countryCodes: iStringNested;
  data: iStringNested;
  dataSource: string;

  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/covid',
        parameters: [
          {
            name: 'country',
            required: false,
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
      dataSource: 'Data source',
      deaths: 'Deaths',
      cumulativeDeaths: 'Cumulative deaths',
      deathsLast7Days: 'Newly reported deaths',
      deathsLast7DaysChange: 'Deaths last 7 days change',
      deathsPerMillion: 'Deaths per million',
      confirmed: 'Cases',
      cumulativeConfirmed: 'Cumulative cases',
      casesLast7Days: 'Newly reported cases',
      casesLast7DaysChange: 'Cases last 7 days change',
      casesPerMillion: 'Cases per million',
    };
    this.cronExpression = '0 * * * *';

    this.dataSource = 'https://covid19.who.int/table';
  }
  async run(msg: Message): Promise<void> {
    if (this.data == undefined) {
      await this.update();
    }
    let text = '';
    if (isCommand(this, 1, msg.content)) {
      const input = getInput(msg, false);
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      } else {
        const countryCode = this.findCountryCode(input);
        if (!countryCode || (countryCode && this.data[countryCode] == undefined)) {
          return this.bot.replyMessage(msg, this.bot.errors.noResults);
        } else {
          text = `<b>${this.countryCodes[countryCode].name} COVID-19 situation</b>:`;
          const values = ['confirmed', 'deaths'];
          for (const value of values) {
            text += `\n${this.strings[value]}: ${formatNumber(this.data[countryCode][value])}`;
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

  async cron(): Promise<void> {
    await this.update();
  }

  async update(): Promise<void> {
    if (this.countryCodes == undefined) {
      await this.getCountryCodes();
    }
    const resp = await sendRequest('https://covid19.who.int/page-data/table/page-data.json');
    const content = await resp.json();
    const countryGroups = content.result.pageContext.countryGroups;
    this.data = {};
    for (const country of countryGroups) {
      const code = country.value.toLowerCase();
      this.data[code] = {};
      for (let i = 0; i < country.data.metrics.length; i++) {
        this.data[code][camelCase(country.data.metrics[i].name)] = country.data.totals[i];
      }
    }
    logger.info('Updated COVID-19 data');
  }

  async getCountryCodes(): Promise<void> {
    const resp = await sendRequest('https://www.iban.com/country-codes');
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
