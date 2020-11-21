import { Bot, ConversationInfo, Message, User } from '.';

export abstract class BindingsBase {
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  abstract async start(): Promise<void>;

  abstract async stop(): Promise<void>;

  abstract async getMe(): Promise<User>;

  abstract async getMessage(
    chatId: string | number,
    messageId: string | number,
    ignoreReply?: boolean,
  ): Promise<Message>;

  abstract async deleteMessage(chatId: string | number, messageId: string | number): Promise<boolean>;

  abstract async getFile(fileId: string | number, link?: boolean): Promise<string>;

  abstract async checkInviteLink(inviteLink: string | number): Promise<boolean>;

  abstract async joinByInviteLink(inviteLink: string | number): Promise<boolean>;

  abstract async inviteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean>;

  abstract async promoteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean>;

  abstract async kickConversationMember(conversationId: string | number, userId: string | number): Promise<boolean>;

  abstract async banConversationMember(conversationId: string | number, userId: string | number): Promise<boolean>;

  abstract async unbanConversationMember(conversationId: string | number, userId: string | number): Promise<boolean>;

  abstract async renameConversation(conversationId: string | number, title: string): Promise<boolean>;

  abstract async changeConversationDescription(conversationId: string | number, description: string): Promise<boolean>;

  abstract async changeConversationPhoto(conversationId: string | number, photo: string): Promise<boolean>;

  abstract async conversationInfo(conversationId: string | number): Promise<ConversationInfo>;

  abstract async getChatAdministrators(conversationId: string | number): Promise<User[]>;
}
