import { Client, Message as DiscordMessage, MessageAttachment, MessageEmbed } from 'discord.js';
import { BindingsBase, Bot, Conversation, Message, User } from '..';
import { db } from '../main';
import { getExtension, htmlToDiscordMarkdown, logger, splitLargeMessage } from '../utils';

export class DiscordBindings extends BindingsBase {
  client: Client;
  constructor(bot: Bot) {
    super(bot);
    this.client = new Client({
      presence: {
        activity: {
          name: `${this.bot.config.prefix}help`,
          type: 'LISTENING',
        },
      },
    });
  }

  async start(): Promise<void> {
    this.client.on('ready', () => {
      this.bot.user = new User(
        this.client.user.id,
        this.client.user.username,
        this.client.user.discriminator,
        this.client.user.tag,
        this.client.user.bot,
      );
      this.bot.status.emit('started');
    });

    this.client.on('message', (message: DiscordMessage) => this.messageEventHandler(message));
    this.client.login(this.bot.config.apiKeys.discordBotToken).then(
      (tok) => {
        logger.debug(`Bot logged in successfully!\n\n${tok}\n\n`);
      },
      (err) => {
        logger.error(`${this.bot.config.name} (${this.bot.config.bindings}) failed to start:\n${err}`);
        this.client.destroy();
      },
    );
    this.bot.outbox.on('message', (msg: Message) => this.sendMessage(msg));
  }

  async stop(): Promise<void> {
    this.client.destroy();
    this.client.removeAllListeners('ready');
    this.client.removeAllListeners('message');
    this.bot.outbox.removeAllListeners('message');
    this.bot.status.emit('stopped');
  }

  async getMe(): Promise<User> {
    return new User(
      this.client.user.id,
      this.client.user.username,
      `#${this.client.user.discriminator}`,
      this.client.user.tag,
      this.client.user.bot,
    );
  }

  async convertMessage(msg: DiscordMessage): Promise<Message> {
    const id = msg.id;
    const extra = {};
    const content = msg.content;
    const type = 'text';
    const date = new Date().getTime() / 1000;
    const reply = null;
    const sender = new User(
      msg.author.id,
      msg.author.username,
      `#${msg.author.discriminator}`,
      msg.author.tag,
      msg.author.bot,
    );
    const conversation = new Conversation('-' + msg.channel.id);
    const channel = await this.client.channels.fetch(msg.channel.id);
    if (channel.constructor.name == 'DMChannel') {
      conversation.id = channel['recipient']['id'];
      conversation.title = channel['recipient']['username'];
    } else {
      conversation.title = channel['name'];
    }
    return new Message(id, conversation, sender, content, type, date, reply, extra);
  }

  async messageEventHandler(message: DiscordMessage): Promise<void> {
    // // don't respond to ourselves
    if (+message.author.id == this.bot.user.id) {
      return;
    }

    // if (message.content.startsWith('/') || message.content.startsWith(this.bot.config.prefix)) {
    //   message.channel.startTyping();
    // }

    this.bot.inbox.emit('message', await this.convertMessage(message));
  }

  async sendMessage(msg: Message): Promise<void> {
    if (msg.content) {
      let chat;
      if (+msg.conversation.id > 0) {
        chat = await (await this.client.users.fetch(String(msg.conversation.id))).dmChannel;
      } else {
        chat = await this.client.channels.fetch(String(msg.conversation.id).slice(1));
      }
      if (chat) {
        chat.startTyping();
        if (msg.type == 'text') {
          let content = this.addDiscordMentions(msg.content);
          if (msg.extra) {
            if ('format' in msg.extra && msg.extra['format'] == 'HTML') {
              content = htmlToDiscordMarkdown(content);
            }
            if ('preview' in msg.extra && !msg.extra['preview']) {
              content = content.replace(
                new RegExp('http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*(),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', 'gim'),
                '<$&>',
              );
            }
          }

          if (content.length > 2000) {
            const texts = splitLargeMessage(content, 2000);
            for (const text in texts) {
              await chat.send(text);
            }
          } else {
            await chat.send(content);
          }
        } else if (msg.type == 'photo' || msg.type == 'document' || msg.type == 'video' || msg.type == 'voice') {
          let sendContent = true;
          const embed = new MessageEmbed();

          if (msg.extra && 'caption' in msg.extra && msg.extra['caption']) {
            const lines = msg.extra['caption'].split('\n');
            embed.title = lines[0];
            lines.splice(0, 1);
            embed.description = lines.join('\n');
            sendContent = false;
          }

          if (sendContent) {
            if (msg.content.startsWith('/') || msg.content.startsWith('C:\\')) {
              await chat.send(new MessageAttachment(msg.content, msg.type + getExtension(msg.content)));
            } else {
              await chat.send(msg.content);
            }
          } else {
            if (msg.content.startsWith('/') || msg.content.startsWith('C:\\')) {
              embed.attachFiles([new MessageAttachment(msg.content, msg.type + getExtension(msg.content))]);
              await chat.send(embed);
            } else if (msg.content.startsWith('http')) {
              if (msg.type == 'photo') {
                embed.setImage(msg.content);
              }
            } else if (msg.type == 'video') {
              embed.setURL(msg.content);
            } else {
              embed.setURL(msg.content);
            }
            await chat.send(embed);
          }
        }
        chat.stopTyping();
      }
    }
  }

  findDiscordUserInDatabase(username: string): string {
    for (const uid of Object.keys(db.users)) {
      if (db.users[uid].username == username.substring(1)) {
        return uid;
      }
    }
    return null;
  }

  addDiscordMentions(content: string): string {
    const matches = new RegExp('(@.[^@]+#\\d+)', 'gim').exec(content);
    if (matches) {
      for (const match of matches) {
        const userId = this.findDiscordUserInDatabase(match);
        if (userId) {
          content = content.replace(new RegExp(match, 'gim'), `<@${userId}>`);
        }
      }
    }
    return content;
  }

  async getChatAdministrators(conversationId: string | number): Promise<User[]> {
    const channel = await this.client.channels.fetch(String(conversationId).slice(1));
    console.log(JSON.stringify(channel));
    const admins = [];
    // for (const member of channel.members) {
    //   const perms = channel.permissionsFor(member);
    //   if (perms.administrator) {
    //     admins.push(
    //       new User(
    //         member.id,
    //         member.name,
    //         '#' + member.discriminator,
    //         member.name + '#' + member.discriminator,
    //         member.bot,
    //       ),
    //     );
    //   }
    // }
    return admins;
  }
}
