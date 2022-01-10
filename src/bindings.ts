import { IncomingMessage, ServerResponse } from 'http';
import { Bot, ConversationInfo, Message, User } from '.';

export abstract class BindingsBase {
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  abstract start(): Promise<void>;

  abstract stop(): Promise<void>;

  abstract getMe(): Promise<User>;

  abstract webhookHandler(req: IncomingMessage, res: ServerResponse, data: string): Promise<void>;

  abstract getMessage(chatId: string | number, messageId: string | number, ignoreReply?: boolean): Promise<Message>;

  abstract deleteMessage(chatId: string | number, messageId: string | number): Promise<boolean>;

  abstract getFile(fileId: string | number, link?: boolean): Promise<string>;

  abstract createInviteLink(
    conversationId: string | number,
    name?: string,
    createsJoinRequest?: boolean,
    expirationDate?: number,
    memberLimit?: number,
  ): Promise<string>;

  abstract checkInviteLink(inviteLink: string | number): Promise<boolean>;

  abstract joinByInviteLink(inviteLink: string | number): Promise<boolean>;

  abstract inviteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean>;

  abstract promoteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean>;

  abstract kickConversationMember(conversationId: string | number, userId: string | number): Promise<boolean>;

  abstract leaveConversation(conversationId: string | number): Promise<boolean>;

  abstract banConversationMember(conversationId: string | number, userId: string | number): Promise<boolean>;

  abstract unbanConversationMember(conversationId: string | number, userId: string | number): Promise<boolean>;

  abstract renameConversation(conversationId: string | number, title: string): Promise<boolean>;

  abstract changeConversationDescription(conversationId: string | number, description: string): Promise<boolean>;

  abstract changeConversationPhoto(conversationId: string | number, photo: string): Promise<boolean>;

  abstract createCall(conversationId: string | number, isVideo: boolean): Promise<boolean>;

  abstract conversationInfo(conversationId: string | number): Promise<ConversationInfo>;

  abstract getChatAdministrators(conversationId: string | number): Promise<User[]>;
}
