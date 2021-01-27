import { Message as DiscordMessage } from 'discord.js';
import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { BindingsBase, Bot, ConversationInfo, Message, User } from '..';
import { logger } from '../utils';

export class FacebookBindings extends BindingsBase {
  constructor(bot: Bot) {
    super(bot);
  }

  async start(): Promise<void> {
    this.bot.user = new User(this.bot.config.name, this.bot.config.name, null, this.bot.config.name, true);
    this.bot.outbox.on('message', (msg: Message) => this.sendMessage(msg));
    this.bot.status.emit('started');
  }

  async stop(): Promise<void> {
    this.bot.outbox.removeAllListeners('message');
    this.bot.status.emit('stopped');
  }

  async getMe(): Promise<User> {
    return new User(this.bot.config.name, this.bot.config.name, null, this.bot.config.name, true);
  }

  async webhookHandler(req: IncomingMessage, res: ServerResponse, data: any): Promise<void> {
    logger.info('facebook webhookHandler');
    logger.debug(data);
    // Parse the query params
    const query = parse(req.url, true).query;

    // Checks if a token and mode is in the query string of the request
    if (query['hub.mode'] && query['hub.verify_token']) {
      // Checks the mode and token sent is correct
      if (
        query['hub.mode'] === 'subscribe' &&
        query['hub.verify_token'] === this.bot.config.apiKeys.facebookVerifyToken
      ) {
        // Responds with the challenge token from the request
        logger.info('WEBHOOK_VERIFIED');
        res.statusCode = 200;
        res.writeHead(200);
        res.end(query['hub.challenge']);
      } else {
        // Responds with '403 Forbidden' if verify tokens do not match
        res.statusCode = 403;
        res.writeHead(403);
        res.end(403);
      }
    }
  }

  async convertMessage(msg: DiscordMessage): Promise<Message> {
    logger.debug(msg);
    return null;
    // const received = now();
    // const id = msg.id;
    // const extra = {
    //   received,
    // };
    // const content = msg.content;
    // const type = 'text';
    // const date = msg.createdTimestamp;
    // const reply = null;
    // const sender = new User(
    //   msg.author.id,
    //   msg.author.username,
    //   `#${msg.author.discriminator}`,
    //   msg.author.tag,
    //   msg.author.bot,
    // );
    // const conversation = new Conversation('-' + msg.channel.id);
    // const channel = await this.client.channels.fetch(msg.channel.id);
    // if (channel.constructor.name == 'DMChannel') {
    //   conversation.id = channel['recipient']['id'];
    //   conversation.title = channel['recipient']['username'];
    // } else {
    //   conversation.title = channel['name'];
    // }
    // return new Message(id, conversation, sender, content, type, date, reply, extra);
  }

  async sendMessage(msg: Message): Promise<void> {
    logger.debug(msg);
  }

  async getMessage(chatId: string | number, messageId: string | number, ignoreReply?: boolean): Promise<Message> {
    console.debug(chatId, messageId, ignoreReply);
    return null;
  }
  async deleteMessage(chatId: string | number, messageId: string | number): Promise<boolean> {
    console.debug(chatId, messageId);
    return null;
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
    console.debug(conversationId, userId);
    return null;
  }
  async leaveConversation(conversationId: string | number): Promise<boolean> {
    console.debug(conversationId);
    return null;
  }
  async banConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.debug(conversationId, userId);
    return null;
  }
  async unbanConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.debug(conversationId, userId);
    return null;
  }
  async renameConversation(conversationId: string | number, title: string): Promise<boolean> {
    console.debug(conversationId, title);
    return null;
  }
  async changeConversationDescription(conversationId: string | number, description: string): Promise<boolean> {
    console.debug(conversationId, description);
    return null;
  }
  async changeConversationPhoto(conversationId: string | number, photo: string): Promise<boolean> {
    console.debug(conversationId, photo);
    return null;
  }
  async conversationInfo(conversationId: string | number): Promise<ConversationInfo> {
    console.debug(conversationId);
    return null;
  }
  async getChatAdministrators(conversationId: string | number): Promise<User[]> {
    console.debug(conversationId);
    return [];
  }
}
