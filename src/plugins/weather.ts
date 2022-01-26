import format from 'string-format';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { capitalize, generateCommandHelp, getCoords, getInput, sendRequest } from '../utils';

export class WeatherPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/weather',
        friendly: '^weather for ',
        aliases: ['/w'],
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
      appid: this.bot.config.apiKeys.openWeather,
      lon: coords.lng,
      lat: coords.lat,
      units: 'metric',
      lang: this.bot.config.locale.slice(0, 2),
    };
    const resp = await sendRequest(url, params, null, null, false, this.bot);
    if (!resp) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    const content = (await resp.json()) as any;
    if (!content || content.cod != 200) {
      return this.bot.replyMessage(msg, this.bot.errors.noResults);
    }
    const title = `<b>${format(this.strings.title, coords.locality, coords.country)}</b>:`;
    const weather = capitalize(content.weather[0].description);
    const icon = this.getWeatherIcon(content.weather[0].icon);
    const temp = content.main.temp;
    const humidity = content.main.humidity;
    const wind = content.wind.speed;
    const text = `${title}\n${icon} ${weather}\n🌡${temp}ºC 💧${humidity}% 🌬${wind} m/s`;
    this.bot.replyMessage(msg, text);
  }

  getWeatherIcon(icon: string): string {
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
