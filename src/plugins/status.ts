import os from 'os';
import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { formatTimeInSeconds } from '../utils';

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
    this.strings = {
      platform: 'Platform',
      release: 'Kernel',
      version: 'Version',
      hostname: 'Hostname',
      load: 'Load',
      uptime: 'Uptime',
      memory: 'RAM',
    };
  }
  async run(msg: Message): Promise<void> {
    let text = '';
    const usedmem = (os.totalmem() - os.freemem()) / (1024 * 1024);
    const totalmem = os.totalmem() / (1024 * 1024);
    const mem = (usedmem / totalmem) * 100;
    text += `\n${this.strings.platform}: <code>${os.platform()}</code>`;
    text += `\n${this.strings.release}: <code>${os.release()}</code>`;
    text += `\n${this.strings.version}: <code>${os.version()}</code>`;
    text += `\n${this.strings.hostname}: <code>${os.hostname()}</code>`;
    text += `\n${this.strings.load}: <code>${os.loadavg()[0]}</code>`;
    text += `\n${this.strings.uptime}: <code>${formatTimeInSeconds(os.uptime())}</code>`;
    text += `\n${this.strings.memory}: <code>${Math.round(usedmem)}/${Math.round(totalmem)} (${Math.round(
      mem,
    )}%)</code>`;
    this.bot.replyMessage(msg, text);
  }
}
