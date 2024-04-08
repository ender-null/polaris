import { ConversationInfo, Message, User } from './types';

export class Actions {
  async getMessage(chatId: string | number, messageId: string | number, ignoreReply?: boolean): Promise<Message> {
    console.log(chatId, messageId, ignoreReply);
    return null;
  }
  async deleteMessage(chatId: string | number, messageId: string | number): Promise<boolean> {
    console.log(chatId, messageId);
    return null;
  }
  async getFile(fileId: string | number, link?: boolean): Promise<string> {
    console.log(fileId, link);
    return null;
  }
  async createInviteLink(
    conversationId: string | number,
    name?: string,
    createsJoinRequest?: boolean,
    expirationDate?: number,
    memberLimit?: number,
  ): Promise<string> {
    console.log(conversationId, name, createsJoinRequest, expirationDate, memberLimit);
    return null;
  }
  async checkInviteLink(inviteLink: string | number): Promise<boolean> {
    console.log(inviteLink);
    return null;
  }
  async joinByInviteLink(inviteLink: string | number): Promise<boolean> {
    console.log(inviteLink);
    return null;
  }
  async inviteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.log(conversationId, userId);
    return null;
  }
  async promoteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.log(conversationId, userId);
    return null;
  }
  async kickConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.log(conversationId, userId);
    return null;
  }
  async leaveConversation(conversationId: string | number): Promise<boolean> {
    console.log(conversationId);
    return null;
  }
  async banConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.log(conversationId, userId);
    return null;
  }
  async unbanConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.log(conversationId, userId);
    return null;
  }
  async renameConversation(conversationId: string | number, title: string): Promise<boolean> {
    console.log(conversationId, title);
    return null;
  }
  async changeConversationDescription(conversationId: string | number, description: string): Promise<boolean> {
    console.log(conversationId, description);
    return null;
  }
  async changeConversationPhoto(conversationId: string | number, photo: string): Promise<boolean> {
    console.log(conversationId, photo);
    return null;
  }
  async createCall(conversationId: string | number, isVideo: boolean): Promise<boolean> {
    console.log(conversationId, isVideo);
    return null;
  }
  async conversationInfo(conversationId: string | number): Promise<ConversationInfo> {
    console.log(conversationId);
    return null;
  }
  async getChatAdministrators(conversationId: string | number): Promise<User[]> {
    console.log(conversationId);
    return null;
  }
}
