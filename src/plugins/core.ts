import { Bot } from '../bot';
import { PluginBase } from '../plugin';
import { Message } from '../types';
import { execResult, generateCommandHelp, getInput, isCommand, isOwner, isTrusted } from '../utils';

export class CorePlugin extends PluginBase {
  constructor(bot: Bot) {
    super(bot);
    this.commands = [
      {
        command: '/shutdown',
        description: 'Shuts down the bot',
        hidden: true,
      },
      {
        command: '/reload',
        description: 'Reload the bot',
        hidden: true,
      },
      {
        command: '/reloadplugins',
        description: 'Reloads plugins',
        hidden: true,
      },
      {
        command: '/rebirth',
        description: 'Reset all client data',
        hidden: true,
      },
      {
        command: '/message',
        aliases: ['/msg', '/pm'],
        description: 'Send message to chat',
        parameters: [
          {
            name: 'target',
            required: true,
          },
          {
            name: 'message',
            required: true,
          },
        ],
        hidden: true,
      },
      {
        command: '/javascript',
        aliases: ['/js'],
        description: 'Runs JavaScript code',
        parameters: [
          {
            name: 'code',
            required: true,
          },
        ],
        hidden: true,
      },
    ];
    this.strings = {
      reloadingPlugins: 'Reloading plugins...',
      restarting: 'Restarting...',
      shuttingDown: 'Shutting down...',
    };
  }

  async run(msg: Message): Promise<void> {
    if (!isOwner(this.bot, msg.sender.id, msg) && !isTrusted(this.bot, msg.sender.id, msg)) {
      return this.bot.replyMessage(msg, this.bot.errors.permissionRequired);
    }
    const input = getInput(msg);
    let text = this.bot.errors.noResults;

    if (isCommand(this, 1, msg.content)) {
      //await this.bot.stop();
      text = this.strings.shuttingDown;
    } else if (isCommand(this, 2, msg.content)) {
      //await this.bot.stop();
      //await this.bot.start();
      text = this.strings.restarting;
    } else if (isCommand(this, 3, msg.content)) {
      this.bot.initPlugins();
      text = this.strings.reloadingPlugins;
    } else if (isCommand(this, 4, msg.content)) {
      text = this.bot.errors.notImplemented;
    } else if (isCommand(this, 5, msg.content)) {
      if (this.bot.user.isBot || this.bot.config.platform != 'TelegramTDlibBindings') {
        text = this.bot.errors.notImplemented;
      } else {
        text = 'TODO';
      }
    } else if (isCommand(this, 6, msg.content)) {
      if (!input) {
        return this.bot.replyMessage(msg, generateCommandHelp(this, msg.content));
      }
      let result;
      try {
        result = eval(input);
      } catch (error) {
        result = error.message;
      }
      text = `<code class="language-javascript">&gt; ${input}\n\n${result}</code>`;
    }

    this.bot.replyMessage(msg, text);
  }

  async always(msg: Message): Promise<void> {
    if (
      msg.conversation.id == this.bot.config.alertsConversationId ||
      msg.conversation.id == this.bot.config.adminConversationId
    ) {
      return;
    }

    if (msg.sender.id == 777000 && !String(msg.conversation.id).startsWith('-')) {
      const inputMatch = new RegExp('\\d{5}').exec(msg.content);
      if (inputMatch && inputMatch.length > 0) {
        const code = inputMatch[0].split('').join('\u200c');
        this.bot.sendAlert(`Login code: ${code}`);
      }
    }

    const urls = [];
    if (msg.extra && msg.extra.urls) {
      urls.push(...msg.extra['urls']);
    }

    if (msg.extra && msg.extra.replyMarkup && msg.extra.replyMarkup._ == 'replyMarkupInlineKeyboard') {
      for (const row of msg.extra.replyMarkup.rows) {
        for (const btn of row) {
          if (btn.type == 'inlineKeyboardButtonTypeUrl') {
            urls.push(btn.url);
          }
        }
      }
    }

    /*urls.map((url) => {
      const inputMatch = telegramLinkRegExp.exec(url);
      if (inputMatch && inputMatch.length > 0) {
        logger.info(`Found Telegram link: ${url}`);
        const fixedUrl = fixTelegramLink(url);

        let knownLink = false;
        Object.keys(db.groups).map((gid) => {
          if (db.groups[gid].invite_link && db.groups[gid].invite_link == fixedUrl) {
            knownLink = true;
            logger.info(`Known link: ${fixedUrl}`);
            return;
          }
        });

        if (!knownLink) {
          const chat = this.bot.bindings.checkInviteLink(fixedUrl);
          if (chat) {
            logger.info('checkInviteLink: ' + JSON.stringify(chat));
            if (chat['chat_id'] == 0) {
              const ok = this.bot.bindings.joinByInviteLink(fixedUrl);
              if (ok) {
                const cid = ok['id'];
                this.bot.sendAdminAlert(`Joined ${ok['title']} [${cid}] by invite link: ${fixedUrl}`);
                if (db.groups[cid] != undefined) {
                  db.groups[cid].invite_link = fixedUrl;
                  db.groups[cid].member_count = chat['member_count'] || 0;
                  db.groups[cid].title = ok['title'];
                  update(db.groupsSnap.child(cid).ref, db.groups[cid]);
                } else {
                  db.groups[cid] = {
                    invite_link: fixedUrl,
                    member_count: chat['member_count'] || 0,
                    title: ok['title'],
                  };
                  set(db.groupsSnap.child(cid).ref, db.groups[cid]);
                }
              }
            }
          } else {
            logger.info(`Invalid link: ${fixedUrl}`);
          }
        }
      }
    });*/
  }
}
