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
          if (command.command) {
            const doc = generateCommandHelp(plugin, command.command, false, true);
            // If the command is hidden, ignore it
            if (doc && !command.hidden) {
              const lines = doc.split('\n');
              if (!isCommand(this, 3, msg.content) || this.bot.config.prefix == '/' || command.keepDefault) {
                if (showAll) {
                  text += `\n${lines[0]}`;
                } else {
                  if (!command.skipHelp) {
                    text += `\n${lines[0]}\n\s${lines[1] || this.strings.noDescription}`;
                  }
                }
              }
            }
            const docAlt = generateCommandHelp(plugin, command.command, true, true);
            if (docAlt) {
              const linesAlt = docAlt.split('\n');
              const commandInfo = {
                command: getWord(linesAlt[0], 1).slice(1),
                parameters: command.parameters || null,
                description: this.strings.noDescription,
                hidden: command.hidden || false,
              };

              if (linesAlt.length > 1) {
                commandInfo.description = removeHtml(linesAlt[1]);
              }
              commands.push(commandInfo);
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
