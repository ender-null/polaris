import { Bot, Message } from '..';
import { PluginBase } from '../plugin';
import { generateCommandHelp, isCommand } from '../utils';

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
  }
  async run(msg: Message): Promise<void> {
    const commands = [];
    let text;

    if (isCommand(this, 2, msg.content)) {
      text = '';
    } else {
      text = `<b>Commands</b>:`;
    }

    // Iterates the initialized plugin
    for (const plugin of this.bot.plugins) {
      if ('commands' in plugin) {
        for (const command of plugin.commands) {
          // Adds the command and parameters
          if (isCommand(this, 2, msg.content)) {
            let show = false;
            if ('parameters' in command && command.parameters) {
              let allOptional = true;
              for (const parameter of command.parameters) {
                if (parameter.required) {
                  allOptional = false;
                }
              }
              show = allOptional;
            } else {
              show = true;
            }

            if (this.bot.config.prefix != '/' && (!('keepDefault' in command) || !command.keepDefault)) {
              show = false;
            }

            if (command.command.startsWith('/')) {
              show = false;
            }

            if (show) {
              text += `\n${command.command.substring(1)}`;

              if ('description' in command) {
                text += ` - ${command.description}`;
                commands.push({
                  command: command.command.substring(1),
                  description: command.description,
                });
              } else {
                text += ' - No description';
                commands.push({
                  command: command.command.substring(1),
                  description: 'No description',
                });
              }
            }
          } else {
            // If the command is hidden, ignore it
            if (!('hidden' in command) || !command.hidden) {
              const doc = generateCommandHelp(plugin, command.command, false);
              if (doc) {
                const lines = doc.split('\n');

                text += `\n • ${lines[0]}`;

                if (lines.length > 1) {
                  text += `\n   ${lines[1]}`;
                } else {
                  text += `\n   <i>No description</i>`;
                }
              }
            }
          }
        }
      }
    }

    this.bot.replyMessage(msg, text, 'text', null, { format: 'HTML' });
  }
}
