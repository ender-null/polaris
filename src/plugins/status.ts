import os from 'os';
import process from 'process';
import { PluginBase } from '../plugin';
import { formatTimeInSeconds } from '../utils';
import { Bot } from '../bot';
import { Message } from '../types';

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
      running: 'Running on',
      load: 'Load',
      uptime: 'Uptime',
      memory: 'Memory',
      nodeVersion: 'Node.js',
      day: 'day',
      days: 'days',
    };
  }
  async run(msg: Message): Promise<void> {
    let text = '';
    const usedmem = process.memoryUsage().heapUsed / (1024 * 1024);
    const totalmem = process.memoryUsage().heapTotal / (1024 * 1024);
    const mem = (usedmem / totalmem) * 100;
    text += `\n💻 ${this.strings.running}: <code>${os.platform()} ${os.release()} ${process.arch}</code>`;
    text += `\n⚙️ ${this.strings.memory}: <code>${Math.round(usedmem)}/${Math.round(totalmem)} (${Math.round(
      mem,
    )}%)</code>`;
    text += `\n🧰 ${this.strings.nodeVersion}: <code>${process.version}</code>`;
    text += `\n📈 ${this.strings.load}: <code>${os.loadavg()[0]}</code>`;
    text += `\n⏳ ${this.strings.uptime}: <code>${formatTimeInSeconds(
      process.uptime(),
      this.strings.day,
      this.strings.days,
    )}</code>`;

    this.bot.replyMessage(msg, text);
  }
}
