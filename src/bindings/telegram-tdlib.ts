import { Response } from 'node-fetch';
import { ParsedUrlQueryInput } from 'querystring';
import { Client } from 'tdl';
import { TDLib } from 'tdl-tdlib-addon';
import { message, ok, Update, user } from 'tdl/types/tdlib';
import { BindingsBase, Bot, Conversation, ConversationInfo, Extra, Message, User } from '..';
import { db } from '../main';
import { catchException, download, hasTag, isInt, logger, sendRequest, splitLargeMessage } from '../utils';

export class TelegramTDlibBindings extends BindingsBase {
  client: Client;
  constructor(bot: Bot) {
    super(bot);
    this.client = new Client(new TDLib(), {
      apiId: this.bot.config.apiKeys.telegramAppId,
      apiHash: this.bot.config.apiKeys.telegramApiHash,
      databaseDirectory: `${process.cwd()}/.tdlib_files/${this.bot.config.name}/database`,
      databaseEncryptionKey: this.bot.config.apiKeys.databaseEncryptionKey,
      filesDirectory: `${process.cwd()}/.tdlib_files/${this.bot.config.name}/files`,
      verbosityLevel: 1,
      tdlibParameters: {
        application_version: 'latest',
        device_model: 'polaris.js',
      },
    });
  }

  async apiRequest(method: string, params: ParsedUrlQueryInput = {}): Promise<Response> {
    const url = `https://api.telegram.org/bot${this.bot.config.apiKeys.telegramBotToken}/${method}`;
    return await sendRequest(url, params, null, null, false, this.bot);
  }

  async serverRequest(
    method: string,
    params: Record<string, unknown> = {},
    ignoreErrors?: boolean,
    processRequest?: boolean,
  ): Promise<any> {
    const query: any = {
      '@type': method,
      ...params,
    };
    return await this.client.invoke(query).catch(async (e) => {
      if (!ignoreErrors) {
        this.bot.sendAlert(JSON.stringify(query));
        catchException(e, this.bot);
      }
      if (processRequest) {
        await this.requestProcessing(query, e);
      }
    });
  }

  async start(): Promise<void> {
    await this.client.connectAndLogin(() => ({
      type: 'bot',
      getToken: (retry) =>
        retry ? Promise.reject('Token is not valid') : Promise.resolve(this.bot.config.apiKeys.telegramBotToken), // Token from @BotFather
    }));

    this.client.on('update', (update: Update) => this.updateHandler(update));
    this.client.on('error', logger.error);
    this.bot.status.emit('started');
    this.bot.outbox.on('message', (msg: Message) => this.sendMessage(msg));
  }

  async stop(): Promise<void> {
    await this.serverRequest('close');
    this.bot.outbox.removeAllListeners('message');
    this.bot.status.emit('stopped');
  }

  async getMe(): Promise<User> {
    const me: user = await this.serverRequest('getMe');
    return new User(me.id, me.first_name, me.last_name, me.username, me.type['_'] == 'userTypeBot');
  }

  async convertMessage(msg: message, ignoreReply?: boolean): Promise<Message> {
    const id = msg['id'];
    const extra: Extra = {};

    const rawChat = await this.serverRequest('getChat', { chat_id: msg.chat_id });
    const conversation = new Conversation(msg['chat_id']);
    let sender = null;
    if (rawChat && 'title' in rawChat) {
      conversation.title = rawChat.title;
    }
    let userId;
    if (msg['sender'] && msg['sender']['user_id']) {
      userId = msg['sender']['user_id'];
    } else if (msg.sender_user_id && msg.sender_user_id > 0) {
      userId = msg.sender_user_id;
    }
    if (userId) {
      const rawSender = await this.serverRequest('getUser', { user_id: userId });
      sender = new User(userId);
      if ('first_name' in rawSender) {
        sender.firstName = String(rawSender.first_name);
      }
      if ('last_name' in rawSender) {
        sender.lastName = String(rawSender.last_name);
      }
      if ('username' in rawSender) {
        sender.username = String(rawSender.username);
      }
    } else {
      sender = new User(conversation.id, conversation.title);
    }

    let content;
    let type;

    if (msg.content._ == 'messageText') {
      content = msg.content.text.text;
      type = 'text';
      if (Array.isArray(msg.content.text['entities'])) {
        for (const entity of msg.content.text.entities) {
          if (entity.type['@type'] == 'textEntityTypeUrl') {
            if (!Array.isArray(extra.urls)) {
              extra.urls = [];
            }
            extra.urls.push(content.slice(entity.offset, entity.offset + entity.length));
          }
          if (entity.type['@type'] == 'textEntityTypeMention') {
            if (!Array.isArray(extra.mentions)) {
              extra.mentions = [];
            }
            extra.mentions.push(content.slice(entity.offset, entity.offset + entity.length));
          }
          if (entity.type['@type'] == 'textEntityTypeMentionText') {
            if (!Array.isArray(extra.mentions)) {
              extra.mentions = [];
            }
            extra.mentions.push(entity['user']['id']);
          }
          if (entity.type['@type'] == 'textEntityTypeHashtag') {
            if (!Array.isArray(extra.hashtags)) {
              extra.hashtags = [];
            }
            extra.hashtags.push(content.slice(entity.offset, entity.offset + entity.length));
          }
        }
      }
    } else if (msg.content._ == 'messagePhoto') {
      content = msg.content.photo.sizes[0].photo.remote.id;
      type = 'photo';
      if (msg.content.caption) {
        extra.caption = msg.content.caption.text;
      }
    } else if (msg.content._ == 'messageAnimation') {
      content = msg.content.animation.animation.remote.id;
      type = 'animation';
      if (msg.content.caption) {
        extra.caption = msg.content.caption.text;
      }
    } else if (msg.content._ == 'messageDocument') {
      content = msg.content.document.document.remote.id;
      type = 'document';
      if (msg.content.caption) {
        extra.caption = msg.content.caption.text;
      }
    } else if (msg.content._ == 'messageAudio') {
      content = msg.content.audio.audio.remote.id;
      type = 'audio';
      if (msg.content.caption) {
        extra.caption = msg.content.caption.text;
      }
    } else if (msg.content._ == 'messageVideo') {
      content = msg.content.video.video.remote.id;
      type = 'video';
      if (msg.content.caption) {
        extra.caption = msg.content.caption.text;
      }
    } else if (msg.content._ == 'messageVoiceNote') {
      content = msg.content.voice_note.voice.remote.id;
      type = 'voice';
      if (msg.content.caption) {
        extra.caption = msg.content.caption.text;
      }
    } else if (msg.content._ == 'messageSticker') {
      content = msg.content.sticker.sticker.remote.id;
      type = 'sticker';
    } else if (msg.content._ == 'messageUnsupported') {
      content = 'Message content that is not supported by the client';
      type = 'unsupported';
    } else {
      content = msg.content._;
      type = 'unsupported';
    }

    let reply: Message = null;
    if (msg['reply_to_message_id'] != undefined && msg['reply_to_message_id'] > 0 && !ignoreReply) {
      reply = await this.getMessage(msg['chat_id'], msg['reply_to_message_id'], true);
    }
    if (msg['via_bot_user_id'] != undefined && msg['via_bot_user_id'] > 0) {
      extra.viaBotUserId = msg['via_bot_user_id'];
    }
    if (msg['restriction_reason'] != undefined && msg['restriction_reason'] != '') {
      extra.restrictionReason = msg['restriction_reason'];
    }
    if (msg['reply_markup'] != undefined) {
      extra.replyMarkup = msg['reply_markup'];
    }
    const date = msg['date'];
    return new Message(id, conversation, sender, content, type, date, reply, extra);
  }

  async updateHandler(update: Update): Promise<void> {
    if (update._ == 'updateNewMessage') {
      if (update.message.is_outgoing) {
        if (update.message.is_channel_post) {
          if (update.message.content._ == 'messageText') {
            return;
          }
        } else {
          return;
        }
      }
      if (update.message) {
        this.bot.inbox.emit('message', await this.convertMessage(update.message));
      }
    }
  }

  async sendMessage(msg: Message): Promise<void> {
    await this.sendChatAction(+msg.conversation.id, msg.type);
    let data = null;
    let inputMessageContent = null;

    if (msg.type == 'text') {
      if (!msg.content || (typeof msg.content == 'string' && msg.content.length == 0)) {
        return;
      }
      let text = null;
      if (msg.extra && 'format' in msg.extra) {
        let parseMode = null;
        let formatedText = null;

        if (msg.extra.format == 'HTML') {
          parseMode = 'textParseModeHTML';
        } else {
          parseMode = 'textParseModeMarkdown';
        }

        formatedText = await this.serverRequest('parseTextEntities', {
          text: msg.content,
          parse_mode: {
            '@type': parseMode,
          },
        });

        if (formatedText) {
          text = formatedText;
        } else {
          text = {
            '@type': 'formattedText',
            text: msg.content,
            entities: [],
          };
        }
      } else {
        text = {
          '@type': 'formattedText',
          text: msg.content,
          entities: [],
        };
      }

      let preview = false;
      if (msg.extra && 'preview' in msg.extra) {
        preview = msg.extra.preview;
      }
      inputMessageContent = {
        '@type': 'inputMessageText',
        text: text,
        disable_web_page_preview: !preview,
      };
    } else if (msg.type == 'photo') {
      inputMessageContent = {
        '@type': 'inputMessagePhoto',
        photo: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          '@type': 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'animation') {
      inputMessageContent = {
        '@type': 'inputMessageAnimation',
        animation: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          '@type': 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'audio') {
      inputMessageContent = {
        '@type': 'inputMessageAudio',
        audio: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          '@type': 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'document') {
      inputMessageContent = {
        '@type': 'inputMessageDocument',
        document: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          '@type': 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'sticker') {
      inputMessageContent = {
        '@type': 'inputMessageSticker',
        sticker: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          '@type': 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'video') {
      inputMessageContent = {
        '@type': 'inputMessageVideo',
        video: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          '@type': 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'voice') {
      inputMessageContent = {
        '@type': 'inputMessageVoiceNote',
        voice_note: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          '@type': 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'forward') {
      data = {
        '@type': 'forwardMessages',
        chat_id: msg.extra.conversation,
        from_chat_id: msg.conversation.id,
        message_ids: [msg.extra.message],
      };
    } else if (msg.type == 'native') {
      data = {
        '@type': msg.content,
        chat_id: msg.conversation.id,
      };

      if (msg.extra && 'title' in msg.extra) {
        data['title'] = msg.extra['title'];
      }
      if (msg.extra && 'userId' in msg.extra) {
        data['user_id'] = msg.extra['userId'];
      }

      if (msg.extra && 'customTitle' in msg.extra) {
        data['custom_title'] = msg.extra['customTitle'];
      }

      if (msg.extra && 'photo' in msg.extra) {
        data['photo'] = this.getInputFile(msg.extra['photo']);
      }

      if (msg.extra && 'description' in msg.extra) {
        data['description'] = msg.extra['description'];
      }

      if (msg.extra && 'messageId' in msg.extra) {
        data['message_id'] = msg.extra['messageId'];
      }

      if (msg.extra && 'stickerSetName' in msg.extra) {
        data['sticker_set_name'] = msg.extra['stickerSetName'];
      }

      if (msg.extra && 'commands' in msg.extra) {
        data['commands'] = msg.extra['commands'];
      }
    } else if (msg.type == 'api') {
      const params = {
        chat_id: msg.conversation.id,
      };

      if (msg.extra && 'userId' in msg.extra) {
        params['user_id'] = msg.extra['userId'];
      }

      if (msg.extra && 'customTitle' in msg.extra) {
        params['custom_title'] = msg.extra['customTitle'];
      }

      if (msg.extra && 'photo' in msg.extra) {
        params['photo'] = msg.extra['photo'];
      }

      if (msg.extra && 'messageId' in msg.extra) {
        params['message_id'] = msg.extra['messageId'];
      }

      if (msg.extra && 'stickerSetName' in msg.extra) {
        params['sticker_set_name'] = msg.extra['stickerSetName'];
      }

      if (msg.extra && 'commands' in msg.extra) {
        params['commands'] = msg.extra['commands'];
      }

      await this.apiRequest(msg.content, params);
      await this.sendChatAction(msg.conversation.id, 'cancel');
      return;
    }

    if (inputMessageContent) {
      data = {
        '@type': 'sendMessage',
        chat_id: msg.conversation.id,
        input_message_content: inputMessageContent,
      };

      if (msg.reply) {
        data['reply_to_message_id'] = msg.reply.id;
      }
    }

    if (data) {
      if (msg.type == 'text' && data['input_message_content']['text']['text'].length > 4000) {
        const texts = splitLargeMessage(data['input_message_content']['text']['text'], 4000);
        for (const text of texts) {
          data['input_message_content']['text']['text'] = text;
          await this.serverRequest(data['@type'], data);
        }
      } else {
        await this.serverRequest(data['@type'], data);
      }
      await this.sendChatAction(+msg.conversation.id, 'cancel');
    }
  }

  async sendChatAction(conversationId: number | string, type = 'text'): Promise<ok> {
    let action = 'chatActionTyping';

    if (type == 'photo') {
      action = 'chatActionUploadingPhoto';
    } else if (type == 'document') {
      action = 'chatActionUploadingDocument';
    } else if (type == 'video') {
      action = 'chatActionUploadingVideo';
    } else if (type == 'voice' || type == 'audio') {
      action = 'chatActionRecordingVoiceNote';
    } else if (type == 'location' || type == 'venue') {
      action = 'chatActionChoosingLocation';
    } else if (type == 'cancel') {
      action = 'chatActionCancel';
    }

    return await this.serverRequest(
      'sendChatAction',
      {
        chat_id: conversationId,
        action: { _: action },
      },
      true,
    );
  }

  getInputFile(content: string): Record<string, unknown> {
    if (content.startsWith('/') || content.startsWith('C:\\')) {
      return {
        '@type': 'inputFileLocal',
        path: content,
      };
    } else if (content.startsWith('http')) {
      return {
        '@type': 'inputFileRemote',
        id: content,
      };
    } else if (isInt(content)) {
      return {
        '@type': 'inputFileId',
        id: content,
      };
    } else {
      return {
        '@type': 'inputFileRemote',
        id: content,
      };
    }
  }

  async requestProcessing(request: any, response: any) {
    const leaveList = [
      'no rights',
      'no write access',
      'not enough rights to send',
      'need administrator rights',
      'channel_private',
    ];
    let otherError = true;
    for (const term of leaveList) {
      if (
        term in response['message'].toLowerCase() &&
        !hasTag(this.bot, request['chat_id'], 'resend:?') &&
        !hasTag(this.bot, request['chat_id'], 'fwd:?')
      ) {
        this.bot.sendAdminAlert(`Leaving chat: ${db.groups[request['chat_id']].title} [{request['chat_id']}]`);
        await this.bot.bindings.kickConversationMember(request['chat_id'], this.bot.user.id);
        otherError = false;
        break;
      }
    }

    if (response['message'].lower() == 'chat not found') {
      logger.info(`Chat not found: ${request['chat_id']}`);
      otherError = false;
    }

    if (otherError) {
      this.bot.sendAlert(request);
      this.bot.sendAlert(response);
    }
  }

  async getMessage(chatId: string | number, messageId: string | number, ignoreReply?: boolean): Promise<Message> {
    const result = await this.serverRequest(
      'getMessage',
      {
        chat_id: chatId,
        message_id: messageId,
      },
      true,
    );
    if (result) {
      return this.convertMessage(result, ignoreReply);
    }

    return null;
  }

  async deleteMessage(chatId: string | number, messageId: string | number): Promise<boolean> {
    return await this.serverRequest('deleteMessages', {
      chat_id: chatId,
      message_ids: [messageId],
      revoke: true,
    });
  }

  async getFile(fileId: string | number, link?: boolean): Promise<string> {
    if (this.bot.user.isBot) {
      const params = {
        file_id: fileId,
      };
      const resp = await this.apiRequest('getFile', params);
      if (resp) {
        const result = await resp.json();
        if ('result' in result) {
          if (link) {
            return `https://api.telegram.org/file/bot${this.bot.config.apiKeys.telegramBotToken}/${result.result.file_path}`;
          } else {
            return download(
              `https://api.telegram.org/file/bot${this.bot.config.apiKeys.telegramBotToken}/${result.result.file_path}`,
            );
          }
        }
      }
    }
    return null;
  }

  async checkInviteLink(inviteLink: string | number): Promise<boolean> {
    if (this.bot.user.isBot) {
      return null;
    }
    return await this.serverRequest('checkChatInviteLink', {
      invite_link: inviteLink,
    });
  }

  async joinByInviteLink(inviteLink: string | number): Promise<boolean> {
    if (this.bot.user.isBot) {
      return null;
    }
    return await this.serverRequest('joinChatByInviteLink', {
      invite_link: inviteLink,
    });
  }

  async inviteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    if (this.bot.user.isBot) {
      return null;
    }
    return await this.serverRequest('addChatMember', {
      chat_id: conversationId,
      user_id: userId,
    });
  }

  async promoteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    if (this.bot.user.isBot) {
      return null;
    }
    return await this.serverRequest('setChatMemberStatus', {
      chat_id: conversationId,
      user_id: userId,
      status: { _: 'chatMemberStatusAdministrator' },
    });
  }

  async kickConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    if (this.bot.user.isBot) {
      return null;
    }
    return await this.serverRequest('setChatMemberStatus', {
      chat_id: conversationId,
      user_id: userId,
      status: { _: 'chatMemberStatusLeft' },
    });
  }

  async banConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    if (this.bot.user.isBot) {
      return null;
    }
    return await this.serverRequest('setChatMemberStatus', {
      chat_id: conversationId,
      user_id: userId,
      status: { _: 'chatMemberStatusBanned' },
    });
  }

  async unbanConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    if (this.bot.user.isBot) {
      return null;
    }
    return await this.serverRequest('setChatMemberStatus', {
      chat_id: conversationId,
      user_id: userId,
      status: { _: 'chatMemberStatusMember' },
    });
  }

  async renameConversation(conversationId: string | number, title: string): Promise<boolean> {
    return await this.serverRequest('setChatTitle', {
      chat_id: conversationId,
      title: title,
    });
  }

  async changeConversationDescription(conversationId: string | number, description: string): Promise<boolean> {
    return await this.serverRequest('setChatDescription', {
      chat_id: conversationId,
      description: description,
    });
  }

  async changeConversationPhoto(conversationId: string | number, photo: string): Promise<boolean> {
    return await this.serverRequest('setChatPhoto', {
      chat_id: conversationId,
      photo: photo,
    });
  }

  async conversationInfo(conversationId: string | number): Promise<ConversationInfo> {
    return await this.serverRequest('getChat', {
      chat_id: conversationId,
    });
  }

  async getChatAdministrators(conversationId: string | number): Promise<User[]> {
    const result = await this.serverRequest(
      'getChatAdministrators',
      {
        chat_id: conversationId,
      },
      true,
    );

    const admins = [];
    if (result && 'administrators' in result) {
      for (const member of result.administrators) {
        const user = new User(member.user_id);

        const rawUser = await this.serverRequest('getUser', {
          user_id: user.id,
        });

        if (rawUser) {
          user.isBot = rawUser.type._ == 'userTypeBot';
          if ('first_name' in rawUser) {
            user.firstName = rawUser.first_name;
          }
          if ('last_name' in rawUser) {
            user.lastName = rawUser.last_name;
          }
          if ('username' in rawUser) {
            user.username = rawUser.username;
          }
        }
        admins.push(user);
      }
    }
    return admins;
  }
}
