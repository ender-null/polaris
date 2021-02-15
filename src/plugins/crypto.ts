import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { formatNumber, generateCommandHelp, getInput, sendRequest } from '../utils';

export class CryptoPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/avgprice',
        parameters: [
          {
            name: 'symbol',
            required: true,
          },
        ],
        description: 'Average price for cryptos using Binance API',
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    const input = getInput(msg, false);
    if (!input) {
      return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
    }
    let symbol = input.toUpperCase();
    if (symbol.length <= 4) {
      symbol += 'EUR';
    }
    const url = 'https://api.binance.com/api/v3/avgPrice';
    const params = {
      symbol,
    };
    const resp = await sendRequest(url, params, null, null, false, this.bot);
    const content = await resp.json();
    if (!content || content['price'] == undefined) {
      return this.bot.replyMessage(msg, this.bot.errors.connectionError);
    }
    const text = `<b>${symbol}</b>: <code>${formatNumber(content['price'])}</code>`;
    return this.bot.replyMessage(msg, text);
  }
}
