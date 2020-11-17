import format from 'string-format';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getCoords, getInput, removeHtml, sendRequest } from '../utils';

export class WeatherPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/weather',
        shortcut: '/w',
        parameters: [
          {
            name: 'place',
            required: false,
          },
        ],
        description: 'Current weather',
      },
    ];
    this.strings = {
      title: 'Weather of {0} ({1})',
    };
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    const coords = await getCoords(input, this.bot);
    if (coords.status == 'ZERO_RESULTS' || coords.status == 'INVALID_REQUEST') {
      return this.bot.replyMessage(msg, this.bot.errors.apiLimitExceeded);
    } else if (coords.status == 'OVER_DAILY_LIMIT') {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    } else if (coords.status == 'REQUEST_DENIED') {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }

    const url = 'https://api.openweathermap.org/data/2.5/weather';
    const params = {
      APPID: this.bot.config.apiKeys.openWeather,
      lon: coords.lng,
      lat: coords.lat,
      units: 'metric',
      lang: this.bot.config.locale.slice(0, 2),
    };
    const res = await sendRequest(url, params);
    const content = await res.json();
    if (!content || content.cod != 200) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }
    const title = `<b>${format(this.strings['title'], coords.locality, coords.country)} %s (%s)</b>:`;
    const weatherString = content.weather[0].main;
    const weatherIcon = this.getWeatherIcon(content.weather[0].icon);
    const temp = content.main.temp;
    const humidity = content.main.humidity;
    const wind = content.wind.speed;
    const feelslike = '';
    const text = `'${removeHtml(
      title,
    )}\n${weatherIcon} ${weatherString}${feelslike}\n🌡${temp}ºC 💧${humidity}% 🌬${wind} m/s'`;
    this.bot.replyMessage(msg, text);
  }

  getWeatherIcon(icon: string) {
    const weatherEmoji = {};
    if (icon[2] == 'n') {
      weatherEmoji['01'] = '🌙';
    } else {
      weatherEmoji['01'] = '☀️';
    }
    weatherEmoji['02'] = '⛅️';
    weatherEmoji['03'] = '🌤';
    weatherEmoji['04'] = '☁️';
    weatherEmoji['09'] = '🌧';
    weatherEmoji['10'] = '🌧';
    weatherEmoji['11'] = '⛈';
    weatherEmoji['13'] = '❄️';
    weatherEmoji['50'] = '🌫';
    return weatherEmoji[icon.slice(0, 2)];
  }
}