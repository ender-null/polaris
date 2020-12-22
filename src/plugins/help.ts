import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, getWord, isCommand, removeHtml } from '../utils';

export class HelpPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/help',
        shortcut: '/h',
        description: 'Help about commands.',
        keepDefault: true,
      },
      {
        command: '/genhelp',
        description: 'Regenerate command list',
        hidden: true,
      },
    ];
    this.strings = {
      commands: '<b>Commands</b>:',
      noDescription: 'No description',
    };
  }
  async run(msg: Message): Promise<void> {
    const commands = [];
    let text = this.strings['commands'];

    // Iterates the initialized plugin
    for (const plugin of this.bot.plugins) {
      if ('commands' in plugin) {
        for (const command of plugin.commands) {
          // If the command is hidden, ignore it
          if (!('hidden' in command) || !command.hidden) {
            const doc = generateCommandHelp(plugin, command.command, false);
            if (doc) {
              const lines = doc.split('\n');
              text += `\n • ${lines[0]}`;
              if (this.bot.config.prefix == '/' || command.keepDefault) {
                if (lines.length > 1) {
                  commands.push({
                    command: getWord(lines[0], 1).substr(1),
                    description: removeHtml(lines[1]),
                  });
                } else {
                  commands.push({
                    command: getWord(lines[0], 1).substr(1),
                    description: this.strings['noDescription'],
                  });
                }
              }
            }
          }
        }
      }
    }

    if (isCommand(this, 2, msg.content) && this.bot.config.bindings == 'TelegramTDlibBindings') {
      this.bot.replyMessage(msg, 'setMyCommands', 'api', null, {
        commands: JSON.stringify(commands),
      });
    }

    this.bot.replyMessage(msg, text);
  }
}
