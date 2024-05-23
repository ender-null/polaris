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
        command: '/shell',
        aliases: ['/sh', '/bash'],
        parameters: [
          {
            name: 'code',
            required: true,
            type: 'string',
          },
        ],
        description: 'Run shell commands in system',
        hidden: true,
      },
    ];
    this.strings = {
      systemLoad: 'System load',
      dockerPs: 'Docker processes',
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

    ws.onopen = () => {
      if (isCommand(this, 1, msg.content)) {
        ws.send('status');
      } else if (isCommand(this, 2, msg.content)) {
        ws.send('services');
      } else if (isCommand(this, 3, msg.content)) {
        ws.send(input);
      }
    };

    ws.onerror = (error: ErrorEvent) => {
      this.bot.replyMessage(msg, error.message);
    };

    ws.onmessage = (ev: MessageEvent) => {
      const data = ev.data as string;
      let text = this.bot.errors.noResults;
      if (isCommand(this, 1, msg.content)) {
        const result = JSON.parse(data.slice(7));
        text = `⚖️ ${this.strings.systemLoad}: <b>${result.system_load}</b>`;
        text += `\n⏳ ${this.strings.systemUptime}: <b>${result.system_uptime}</b>`;
        text += `\n🌐 ${this.strings.publicIp}: <code>${result.public_ip}</code>`;
        text += `\n📊 ${this.strings.dockerPs}: <b>${result.docker_ps}</b>`;
        text += `\n📂 ${this.strings.diskUsage}: <b>${result.disk_usage}</b>`;
        text += `\n⚙️ ${this.strings.memoryUsage}: <b>${result.memory_usage}</b>`;
      } else if (isCommand(this, 2, msg.content)) {
        const result = JSON.parse(data.slice(9));
        text = '';
        for (const key in result) {
          text += `\n${result[key] ? '✅' : '🅾️'} <code>${key}</code>`;
        }
      } else {
        text = `<code class="language-shell">$ ${input}\n\n${data.toString()}</code>`;
      }
      this.bot.replyMessage(msg, text);
      ws.close();
    };
  }
}
