import { Bot } from './bot';
import { ConversationInfo, Message, User } from './types';

export class Actions {
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  async getMessage(chatId: string | number, messageId: string | number, ignoreReply?: boolean): Promise<Message> {
    this.bot.sendCommand('getMessage', {
      chatId,
      messageId,
      ignoreReply,
    });
    return null;
  }
  async deleteMessage(chatId: string | number, messageId: string | number): Promise<boolean> {
    this.bot.sendCommand('deleteMessage', {
      chatId,
      messageId,
    });
    return null;
  }
  async getFile(fileId: string | number, link?: boolean): Promise<string> {
    this.bot.sendCommand('getFile', {
      fileId,
      link,
    });
    return null;
  }
  async createInviteLink(
    conversationId: string | number,
    name?: string,
    createsJoinRequest?: boolean,
    expirationDate?: number,
    memberLimit?: number,
  ): Promise<string> {
    this.bot.sendCommand('createInviteLink', {
      conversationId,
      name,
      createsJoinRequest,
      expirationDate,
      memberLimit,
    });
    return null;
  }
  async checkInviteLink(inviteLink: string | number): Promise<boolean> {
    this.bot.sendCommand('checkInviteLink', {
      inviteLink,
    });
    return null;
  }
  async joinByInviteLink(inviteLink: string | number): Promise<boolean> {
    this.bot.sendCommand('joinByInviteLink', {
      inviteLink,
    });
    return null;
  }
  async inviteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    this.bot.sendCommand('inviteConversationMember', {
      conversationId,
      userId,
    });
    return null;
  }
  async promoteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    this.bot.sendCommand('promoteConversationMember', {
      conversationId,
      userId,
    });
    return null;
  }
  async kickConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    this.bot.sendCommand('kickConversationMember', {
      conversationId,
      userId,
    });
    return null;
  }
  async leaveConversation(conversationId: string | number): Promise<boolean> {
    this.bot.sendCommand('leaveConversation', {
      conversationId,
    });
    return null;
  }
  async banConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    this.bot.sendCommand('banConversationMember', {
      conversationId,
      userId,
    });
    return null;
  }
  async unbanConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    this.bot.sendCommand('unbanConversationMember', {
      conversationId,
      userId,
    });
    return null;
  }
  async renameConversation(conversationId: string | number, title: string): Promise<boolean> {
    this.bot.sendCommand('renameConversation', {
      conversationId,
      title,
    });
    return null;
  }
  async changeConversationDescription(conversationId: string | number, description: string): Promise<boolean> {
    this.bot.sendCommand('changeConversationDescription', {
      conversationId,
      description,
    });
    return null;
  }
  async changeConversationPhoto(conversationId: string | number, photo: string): Promise<boolean> {
    this.bot.sendCommand('changeConversationPhoto', {
      conversationId,
      photo,
    });
    return null;
  }
  async createCall(conversationId: string | number, isVideo: boolean): Promise<boolean> {
    this.bot.sendCommand('createCall', {
      conversationId,
      isVideo,
    });
    return null;
  }
  async conversationInfo(conversationId: string | number): Promise<ConversationInfo> {
    this.bot.sendCommand('conversationInfo', {
      conversationId,
    });
    return null;
  }
  async getChatAdministrators(conversationId: string | number): Promise<User[]> {
    this.bot.sendCommand('getChatAdministrators', {
      conversationId,
    });
    return null;
  }
  async setCommands(commands: any[]): Promise<boolean> {
    this.bot.sendCommand('setCommands', {
      commands,
    });
    return null;
  }
}
