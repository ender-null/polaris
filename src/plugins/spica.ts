import { WebSocket } from 'ws';
import { Bot } from '../bot';
import { PluginBase } from '../plugin';
import { Message } from '../types';
import { getInput, isCommand, isOwner, isTrusted } from '../utils';

export class SpicaPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/system',
        description: 'System info',
        hidden: true,
      },
      {
        command: '/services',
        description: 'Services',
        hidden: true,
      },
      {
        command: '/run',
        description: 'Run shell commands in system',
        hidden: true,
      },
    ];
    this.strings = {
      systemLoad: 'System load',
      dockerPs: 'Docker ps.',
      diskUsage: 'Disk usage',
      memoryUsage: 'Memory usage',
      systemUptime: 'System uptime',
      publicIp: 'Public IP',
    };
  }

  async run(msg: Message): Promise<void> {
    if (!isOwner(this.bot, msg.sender.id, msg) && !isTrusted(this.bot, msg.sender.id, msg)) {
      return this.bot.replyMessage(msg, this.bot.errors.permissionRequired);
    }
    const input = getInput(msg);
    const ws: WebSocket = new WebSocket('wss://spica.end.works/wired');
    ws.on('message', async (data: string) => {
      let text = this.bot.errors.noResults;
      if (isCommand(this, 1, msg.content)) {
        const result = JSON.parse(data.slice(7));
        text = `⚖️ ${this.strings.systemLoad}: <code>${result.system_load}</code>`;
        text += `⏳ ${this.strings.systemUptime}: <code>${result.system_uptime}</code>`;
        text += `🌐 ${this.strings.publicIp}: <code>${result.public_ip}</code>`;
        text += `📊 ${this.strings.dockerPs}: <code>${result.docker_ps}</code>`;
        text += `📂 ${this.strings.diskUsage}: <code>${result.disk_usage}</code>`;
        text += `⚙️ ${this.strings.memoryUsage}: <code>${result.memory_usage}</code>`;
      } else if (isCommand(this, 2, msg.content)) {
        const result = JSON.parse(data.slice(9));
        text = '';
        for (const key in result) {
          text += `${key} ${result[key] ? '✅' : '🆘'}`;
        }
      } else {
        text = `<code class="language-shell">$ ${input}\n\n${data.toString()}</code>`;
      }
      this.bot.replyMessage(msg, text);
      ws.close();
    });

    if (isCommand(this, 1, msg.content)) {
      ws.send('status');
    } else if (isCommand(this, 2, msg.content)) {
      ws.send('services');
    } else if (isCommand(this, 3, msg.content)) {
      ws.send(input);
    }
  }
}
