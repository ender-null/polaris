import { Bot } from '../bot';
import { PluginBase } from '../plugin';
import { Message } from '../types';
import { generateCommandHelp, getWord, isCommand, removeHtml } from '../utils';

export class HelpPlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/help',
        aliases: ['/h'],
        description: 'Help about commands.',
        keepDefault: true,
      },
      {
        command: '/allhelp',
        description: 'Help about all commands.',
        keepDefault: true,
      },
      {
        command: '/genhelp',
        description: 'Regenerate command list',
        keepDefault: true,
        hidden: true,
      },
    ];
    this.strings = {
      commands: '<b>Commands</b>:',
      noDescription: 'No description',
    };
  }
  async run(msg: Message): Promise<void> {
    const showAll = isCommand(this, 2, msg.content) || isCommand(this, 3, msg.content);
    const commands = [];
    let text = this.strings.commands;

    // Iterates the initialized plugin
    this.bot.plugins.map((plugin) => {
      if (plugin.commands) {
        plugin.commands.map((command) => {
          // If the command is hidden, ignore it
          if (command.command && !command.hidden) {
            const doc = generateCommandHelp(plugin, command.command, false, true);
            if (doc) {
              const lines = doc.split('\n');
              if (!isCommand(this, 3, msg.content) || this.bot.config.prefix == '/' || command.keepDefault) {
                if (showAll) {
                  text += `\n- ${lines[0]}`;
                } else {
                  if (!command.skipHelp) {
                    text += `\n- ${lines[0]}\n   ${lines[1]}`;
                  }
                }

                const commandInfo = {
                  command: getWord(lines[0], 1).slice(1),
                  parameters: command.parameters,
                  description: this.strings.noDescription,
                };

                if (lines.length > 1) {
                  commandInfo.description = removeHtml(lines[1]);
                }
                commands.push(commandInfo);
              }
            }
          }
        });
      }
    });

    if (isCommand(this, 3, msg.content)) {
      this.bot.bindings.setCommands(commands);
    }

    this.bot.replyMessage(msg, text);
  }
}
