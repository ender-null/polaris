import { IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { BindingsBase, Bot, Conversation, ConversationInfo, Message, User } from '..';
import { isInt, logger, sendRequest } from '../utils';

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
    if (req.method === 'GET') {
      this.handleVerification(req, res);
    } else if (req.method === 'POST') {
      this.handleMessages(data);
    }
  }

  handleVerification(req: IncomingMessage, res: ServerResponse) {
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

  handleMessages(data: any) {
    if (data.object == 'page') {
      for (const entry of data.entry) {
        for (const messagingEvent of entry.messaging) {
          this.bot.inbox.emit('message', this.convertMessage(messagingEvent));
        }
      }
    }
  }

  async convertMessage(msg): Promise<Message> {
    const id = msg.mid;
    const extra = {};
    let content;
    let type = 'text';
    if (msg.message.text) {
      content = msg.message.text;
      type = 'text';
    } else if (msg.message.attachments) {
      type = msg.message.attachments[0].type;
      content = msg.message.attachments[0].payload.url;
      if (msg.message.attachments.length > 1) {
        content = [];
        for (const attach of msg.message.attachments) {
          content.push(attach.payload.url);
        }
      }
    }
    const date = msg.timestamp;
    const reply = null;
    const sender = new User(msg.sender.id, null, msg.sender.id);
    const conversation = new Conversation(msg.sender.id, msg.sender.id);
    return new Message(id, conversation, sender, content, type, date, reply, extra);
  }

  async sendMessage(msg: Message): Promise<void> {
    const params = {
      access_token: this.bot.config.apiKeys.facebookPageAccessToken,
    };
    const headers = {
      'Content-Type': 'application/json',
    };
    const data = {
      messaging_type: 'RESPONSE',
      recipient: {
        id: msg.conversation.id,
      },
      message: null,
      filedata: null,
    };
    if (msg.type == 'text') {
      data.message = {
        text: msg.content,
      };
    } else {
      if (isInt(msg.content)) {
        data.message = {
          attachment: {
            type: msg.type,
            payload: {
              attachment_id: msg.content,
            },
          },
        };
      } else if (msg.content.startsWith('http')) {
        data.message = {
          attachment: {
            type: msg.type,
            payload: {
              url: msg.content,
              is_reusable: true,
            },
          },
        };
      } else {
        data.message = {
          attachment: {
            type: msg.type,
            payload: {
              is_reusable: true,
            },
          },
        };
        data.filedata = msg.content;
      }
    }
    const body = JSON.stringify(data);
    await sendRequest('https://graph.facebook.com/v9.0/me/messages', params, headers, body, true, this.bot);
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
