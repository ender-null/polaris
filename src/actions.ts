import { Bot } from './bot';
import { ConversationInfo, Message, User } from './types';

export class Actions {
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  async getMessage(chatId: string | number, messageId: string | number, ignoreReply?: boolean): Promise<Message> {
    return this.bot.sendCommand('getMessage', {
      chatId,
      messageId,
      ignoreReply,
    }) as Promise<Message>;
  }
  async deleteMessage(chatId: string | number, messageId: string | number): Promise<boolean> {
    return this.bot.sendCommand('deleteMessage', {
      chatId,
      messageId,
    }) as Promise<boolean>;
  }
  async getFile(fileId: string | number, link?: boolean): Promise<string> {
    return this.bot.sendCommand('getFile', {
      fileId,
      link,
    }) as Promise<string>;
  }
  async createInviteLink(
    conversationId: string | number,
    name?: string,
    createsJoinRequest?: boolean,
    expirationDate?: number,
    memberLimit?: number,
  ): Promise<string> {
    return this.bot.sendCommand('createInviteLink', {
      conversationId,
      name,
      createsJoinRequest,
      expirationDate,
      memberLimit,
    }) as Promise<string>;
  }
  async checkInviteLink(inviteLink: string | number): Promise<boolean> {
    return this.bot.sendCommand('checkInviteLink', {
      inviteLink,
    }) as Promise<boolean>;
  }
  async joinByInviteLink(inviteLink: string | number): Promise<boolean> {
    return this.bot.sendCommand('joinByInviteLink', {
      inviteLink,
    }) as Promise<boolean>;
  }
  async inviteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    return this.bot.sendCommand('inviteConversationMember', {
      conversationId,
      userId,
    }) as Promise<boolean>;
  }
  async promoteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    return this.bot.sendCommand('promoteConversationMember', {
      conversationId,
      userId,
    }) as Promise<boolean>;
  }
  async kickConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    return this.bot.sendCommand('kickConversationMember', {
      conversationId,
      userId,
    }) as Promise<boolean>;
  }
  async leaveConversation(conversationId: string | number): Promise<boolean> {
    return this.bot.sendCommand('leaveConversation', {
      conversationId,
    }) as Promise<boolean>;
  }
  async banConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    return this.bot.sendCommand('banConversationMember', {
      conversationId,
      userId,
    }) as Promise<boolean>;
  }
  async unbanConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    return this.bot.sendCommand('unbanConversationMember', {
      conversationId,
      userId,
    }) as Promise<boolean>;
  }
  async renameConversation(conversationId: string | number, title: string): Promise<boolean> {
    return this.bot.sendCommand('renameConversation', {
      conversationId,
      title,
    }) as Promise<boolean>;
  }
  async changeConversationDescription(conversationId: string | number, description: string): Promise<boolean> {
    return this.bot.sendCommand('changeConversationDescription', {
      conversationId,
      description,
    }) as Promise<boolean>;
  }
  async changeConversationPhoto(conversationId: string | number, photo: string): Promise<boolean> {
    return this.bot.sendCommand('changeConversationPhoto', {
      conversationId,
      photo,
    }) as Promise<boolean>;
  }
  async createCall(conversationId: string | number, isVideo: boolean): Promise<boolean> {
    return this.bot.sendCommand('createCall', {
      conversationId,
      isVideo,
    }) as Promise<boolean>;
  }
  async conversationInfo(conversationId: string | number): Promise<ConversationInfo> {
    return this.bot.sendCommand('conversationInfo', {
      conversationId,
    }) as Promise<ConversationInfo>;
  }
  async getChatAdministrators(conversationId: string | number): Promise<User[]> {
    return this.bot.sendCommand('getChatAdministrators', {
      conversationId,
    }) as Promise<User[]>;
  }
  async setCommands(commands: any[]): Promise<boolean> {
    return this.bot.sendCommand('setCommands', {
      commands,
    }) as Promise<boolean>;
  }
}
