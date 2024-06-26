import {
  ActivityType,
  AttachmentBuilder,
  CacheType,
  ChatInputCommandInteraction,
  Client,
  Message as DiscordMessage,
  EmbedBuilder,
  GatewayIntentBits,
  Interaction,
  Partials,
} from 'discord.js';
import { BindingsBase, Bot, Conversation, ConversationInfo, Extra, Message, User } from '..';
import { db } from '../main';
import { htmlToDiscordMarkdown, linkRegExp, logger, splitLargeMessage } from '../utils';

export class DiscordBindings extends BindingsBase {
  client: Client;
  pendingMessages: { msg: Message; message: DiscordMessage }[];
  constructor(bot: Bot) {
    super(bot);
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
      ],
      partials: [Partials.Message, Partials.Channel],
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
      this.client.user.setPresence({
        status: 'online',
        activities: [
          {
            name: `${this.bot.config.prefix}help`,
            type: ActivityType.Listening,
          },
        ],
      });
      this.bot.status.emit('started');
    });
    this.client.on('interactionCreate', (interaction: Interaction<CacheType>) =>
      this.interactionEventHandler(interaction),
    );
    this.client.on('messageCreate', (message: DiscordMessage) => this.messageEventHandler(message));
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
    this.client.removeAllListeners('messageCreate');
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

  async webhookHandler(data: any): Promise<void> {
    logger.debug(data);
  }

  async convertMessage(msg: DiscordMessage): Promise<Message> {
    const id = msg.id;
    const extra: Extra = {
      originalMessage: msg,
    };
    const content = msg.content;
    const type = 'text';
    const date = msg.createdTimestamp;
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

  async convertInteraction(msg: ChatInputCommandInteraction<CacheType>): Promise<Message> {
    const id = msg.id;
    const extra: Extra = {
      originalMessage: msg,
    };
    const content = msg.commandName;
    const type = 'text';
    const date = msg.createdTimestamp;
    const reply = null;
    const sender = new User(msg.user.id, msg.user.username, `#${msg.user.discriminator}`, msg.user.tag, msg.user.bot);
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

  async interactionEventHandler(interaction: Interaction<CacheType>): Promise<void> {
    if (!interaction.isChatInputCommand()) return;
    this.bot.inbox.emit('message', await this.convertInteraction(interaction));
  }

  async messageEventHandler(message: DiscordMessage): Promise<void> {
    // // don't respond to ourselves
    if (+message.author.id == this.bot.user.id) {
      return;
    }
    this.bot.inbox.emit('message', await this.convertMessage(message));
  }

  async sendMessage(msg: Message): Promise<void> {
    if (msg.content) {
      let chat;
      try {
        if (msg.extra.originalMessage) {
          chat = msg.extra.originalMessage.channel;
        } else if (String(msg.conversation.id).startsWith('-')) {
          chat = await this.client.channels.fetch(String(msg.conversation.id).slice(1));
        } else {
          chat = await (await this.client.users.fetch(String(msg.conversation.id))).dmChannel;
        }
      } catch (e) {
        logger.error(`${e.message} ${msg.conversation.id}`);
        return;
      }
      if (chat) {
        // chat.startTyping();
        if (msg.type == 'text') {
          let content = this.addDiscordMentions(msg.content);
          if (msg.extra) {
            if ('format' in msg.extra && msg.extra['format'] == 'HTML') {
              content = htmlToDiscordMarkdown(content);
            }
            if ('preview' in msg.extra && !msg.extra['preview']) {
              content = content.replace(linkRegExp, '<$&>');
            }
          }

          if (content.length > 2000) {
            const texts = splitLargeMessage(content, 2000);
            for (const text of texts) {
              await chat.send(text);
            }
          } else {
            const message = await chat.send(content);
            if (msg.type == 'text' && msg.extra.addPing) {
              const ping = message.createdTimestamp - msg.extra.originalMessage.createdTimestamp;
              message.edit(msg.content + `\n\`${ping.toFixed(3)}\``);
            }
          }
        } else if (msg.type == 'photo' || msg.type == 'document' || msg.type == 'video' || msg.type == 'voice') {
          let sendContent = true;
          const embed = new EmbedBuilder();

          if (msg.extra && 'caption' in msg.extra && msg.extra['caption']) {
            const lines = msg.extra['caption'].split('\n');
            embed.setTitle(lines[0]);
            lines.splice(0, 1);
            embed.setDescription(lines.join('\n'));
            sendContent = false;
          }

          if (sendContent) {
            if (msg.content.startsWith('/') || msg.content.startsWith('C:\\')) {
              const file = new AttachmentBuilder(msg.content);
              await chat.send({ files: [file] });
            } else {
              await chat.send(msg.content);
            }
          } else {
            if (msg.content.startsWith('/') || msg.content.startsWith('C:\\')) {
              const file = new AttachmentBuilder(msg.content);
              await chat.send({ embeds: [embed], files: [file] });
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
        // chat.stopTyping(true);
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

  async getMessage(conversationId: string | number, messageId: string | number): Promise<Message> {
    let chat;
    if (+conversationId > 0) {
      chat = await (await this.client.users.fetch(String(conversationId))).dmChannel;
    } else {
      chat = await this.client.channels.fetch(String(conversationId).slice(1));
    }
    if (chat) {
      const message = await chat.messages.fetch(messageId);
      return this.convertMessage(message);
    }
    return null;
  }
  async deleteMessage(conversationId: string | number, messageId: string | number): Promise<boolean> {
    let chat;
    if (+conversationId > 0) {
      chat = await (await this.client.users.fetch(String(conversationId))).dmChannel;
    } else {
      chat = await this.client.channels.fetch(String(conversationId).slice(1));
    }
    if (chat) {
      await chat.messages.delete(messageId);
      return true;
    }
    return false;
  }
  async getFile(fileId: string | number, link?: boolean): Promise<string> {
    console.debug(fileId, link);
    return null;
  }
  async checkInviteLink(inviteLink: string | number): Promise<boolean> {
    console.debug(inviteLink);
    return null;
  }
  async joinByInviteLink(inviteLink: string | number): Promise<boolean> {
    console.debug(inviteLink);
    return null;
  }
  async inviteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.debug(conversationId, userId);
    return null;
  }
  async promoteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.debug(conversationId, userId);
    return null;
  }
  async kickConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    let chat;
    if (+conversationId > 0) {
      chat = await (await this.client.users.fetch(String(conversationId))).dmChannel;
    } else {
      chat = await this.client.channels.fetch(String(conversationId).slice(1));
    }
    if (chat) {
      await chat.members[userId].kick();
      return true;
    }
    return false;
  }
  async leaveConversation(conversationId: string | number): Promise<boolean> {
    console.debug(conversationId);
    return null;
  }
  async banConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    let chat;
    if (+conversationId > 0) {
      chat = await (await this.client.users.fetch(String(conversationId))).dmChannel;
    } else {
      chat = await this.client.channels.fetch(String(conversationId).slice(1));
    }
    if (chat) {
      await chat.members[userId].ban();
      return true;
    }
    return false;
  }
  async unbanConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.debug(conversationId, userId);
    return null;
  }
  async renameConversation(conversationId: string | number, title: string): Promise<boolean> {
    let chat;
    if (+conversationId > 0) {
      chat = await (await this.client.users.fetch(String(conversationId))).dmChannel;
    } else {
      chat = await this.client.channels.fetch(String(conversationId).slice(1));
    }
    if (chat) {
      await chat.edit({ name: title });
      return true;
    }
    return false;
  }
  async changeConversationDescription(conversationId: string | number, description: string): Promise<boolean> {
    let chat;
    if (+conversationId > 0) {
      chat = await (await this.client.users.fetch(String(conversationId))).dmChannel;
    } else {
      chat = await this.client.channels.fetch(String(conversationId).slice(1));
    }
    if (chat) {
      await chat.edit({ topic: description });
      return true;
    }
    return false;
  }
  async changeConversationPhoto(conversationId: string | number, photo: string): Promise<boolean> {
    console.debug(conversationId, photo);
    return false;
  }
  async conversationInfo(conversationId: string | number): Promise<ConversationInfo> {
    console.debug(conversationId);
    return null;
  }

  async getChatAdministrators(conversationId: string | number): Promise<User[]> {
    const channel = await this.client.channels.fetch(String(conversationId).slice(1));
    console.log(JSON.stringify(channel));
    const admins = [];
    for (const member of channel['members']) {
      console.log(member);
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
    }
    return admins;
  }

  createInviteLink(
    conversationId: string | number,
    name?: string,
    createsJoinRequest?: boolean,
    expirationDate?: number,
    memberLimit?: number,
  ): Promise<string> {
    console.debug(conversationId, name, createsJoinRequest, expirationDate, memberLimit);
    return null;
  }
  createCall(conversationId: string | number, isVideo: boolean): Promise<boolean> {
    console.debug(conversationId, isVideo);
    return null;
  }
}
