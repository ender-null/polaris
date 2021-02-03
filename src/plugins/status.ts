import os from 'os';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';

export class StatusPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/status',
        description: 'Status of the bot and the system',
        skipHelp: true,
      },
    ];
  }
  async run(msg: Message): Promise<void> {
    let text = '';
    text += `\nRelease: ${os.release()}`;
    text += `\nPlatform: ${os.platform()}`;
    text += `\nVersion: ${os.version()}`;
    text += `\nHostname: ${os.hostname()}`;
    text += `\nLoad: ${os.loadavg()}`;
    text += `\nUptime: ${os.uptime()}`;
    text += `\nCPUs: ${os.cpus()}`;
    text += `\nRAM: ${os.totalmem() - os.freemem()}/${os.totalmem()} (${
      (os.totalmem() - os.freemem()) / os.totalmem()
    })`;
    this.bot.replyMessage(msg, text);
  }
}
