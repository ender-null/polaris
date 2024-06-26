import { Response } from 'node-fetch';
import { getTdjson } from 'prebuilt-tdlib';
import { ParsedUrlQueryInput } from 'querystring';
import { Client } from 'tdl';
import { Update, message, ok } from 'tdlib-types';
import { BindingsBase, Bot, Conversation, ConversationInfo, Extra, Message, User } from '..';
import { db } from '../main';
import {
  catchException,
  download,
  hasTag,
  isInt,
  logger,
  sendRequest,
  splitLargeMessage,
  systemName,
  systemVersion,
} from '../utils';
const tdl = require('tdl');

export class TelegramTDlibBindings extends BindingsBase {
  client: Client;
  pendingMessages: { msg: Message; message: message }[];
  constructor(bot: Bot) {
    super(bot);
    try {
      tdl.configure({ tdjson: getTdjson() });
    } catch (e) {}
    this.client = tdl.createClient({
      apiId: this.bot.config.apiKeys.telegramAppId,
      apiHash: this.bot.config.apiKeys.telegramApiHash,
      databaseDirectory: `${process.cwd()}/data/${this.bot.config.name}/database`,
      databaseEncryptionKey: this.bot.config.apiKeys.databaseEncryptionKey,
      filesDirectory: `${process.cwd()}/data/${this.bot.config.name}/files`,
      skipOldUpdates: true,
      verbosityLevel: 1,
      tdlibParameters: {
        application_version: 'latest',
        system_language_code: this.bot.config.locale,
        device_model: systemName(),
        system_version: systemVersion(),
        enable_storage_optimizer: true,
      },
    });
    this.pendingMessages = [];
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
    debug?: boolean,
  ): Promise<any> {
    const query: any = {
      _: method,
      ...params,
    };
    if (debug) logger.info(debug);
    return await this.client.invoke(query).catch(async (e) => {
      if (!ignoreErrors) {
        this.bot.sendAlert(JSON.stringify(query, null, 4));
        catchException(e, this.bot);
      }
      if (processRequest) {
        await this.requestProcessing(query, e);
      }
    });
  }

  async okToBoolean(response): Promise<boolean> {
    if (response && response._ === 'ok') {
      return true;
    }
    return false;
  }

  async start(): Promise<void> {
    if (this.bot.config.apiKeys.telegramBotToken) {
      await this.client.loginAsBot(this.bot.config.apiKeys.telegramBotToken);
    } else if (this.bot.config.apiKeys.telegramPhoneNumber) {
      await this.client.login(() => ({
        getPhoneNumber: (retry) =>
          retry ? Promise.reject('Invalid phone number') : Promise.resolve(this.bot.config.apiKeys.telegramPhoneNumber),
      }));
    }

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
    const me: any = await this.serverRequest('getMe');
    return new User(me.id, me.first_name, me.last_name, me.usernames.editable_username, me.type['_'] == 'userTypeBot');
  }

  async webhookHandler(data: any): Promise<void> {
    logger.debug(data);
  }

  async convertMessage(msg: message, ignoreReply?: boolean): Promise<Message> {
    const id = msg['id'];
    const extra: Extra = {
      originalMessage: msg,
    };

    const rawChat = await this.serverRequest('getChat', { chat_id: msg.chat_id });
    const conversation = new Conversation(msg.chat_id);
    let sender = null;
    if (rawChat && rawChat.title) {
      conversation.title = rawChat.title;
    }
    let userId;
    if (msg.sender_id && msg.sender_id['user_id']) {
      userId = msg.sender_id && msg.sender_id['user_id'];
    }
    if (userId) {
      const rawSender = await this.serverRequest('getUser', { user_id: userId });
      sender = new User(userId);
      if (rawSender) {
        if (rawSender.first_name) {
          sender.firstName = String(rawSender.first_name);
        }
        if (rawSender.last_name) {
          sender.lastName = String(rawSender.last_name);
        }
        if (rawSender.username) {
          sender.username = String(rawSender.username);
        }
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
          if (entity.type._ == 'textEntityTypeUrl') {
            if (!Array.isArray(extra.urls)) {
              extra.urls = [];
            }
            extra.urls.push(content.slice(entity.offset, entity.offset + entity.length));
          }
          if (entity.type._ == 'textEntityTypeMention') {
            if (!Array.isArray(extra.mentions)) {
              extra.mentions = [];
            }
            extra.mentions.push(content.slice(entity.offset, entity.offset + entity.length));
          }
          if (entity.type._ == 'textEntityTypeMentionName') {
            if (!Array.isArray(extra.mentions)) {
              extra.mentions = [];
            }
            extra.mentions.push(entity['user_id']);
          }
          if (entity.type._ == 'textEntityTypeHashtag') {
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
      if (this.bot.user && !this.bot.user.isBot) {
        await this.serverRequest('openChat', {
          chat_id: update['message']['chat_id'],
        });
        await this.serverRequest('viewMessages', {
          chat_id: update['message']['chat_id'],
          message_ids: [update['message']['id']],
          force_read: true,
        });
      }
      if (update.message) {
        const msg = await this.convertMessage(update.message);
        if (msg) {
          this.bot.inbox.emit('message', msg);
        } else {
          logger.error(`convertMessage error, original message: ${JSON.stringify(update.message)}`);
        }
      }
    } else if (update._ == 'updateMessageSendSucceeded') {
      if (this.pendingMessages.length > 0) {
        for (const m of this.pendingMessages) {
          if (update.old_message_id == m.message.id) {
            this.addPingToMessage(m.msg, update.message);
            this.pendingMessages.splice(this.pendingMessages.indexOf(m), 1);
            break;
          }
        }
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
      let preview = false;
      if (msg.extra && 'preview' in msg.extra) {
        preview = msg.extra.preview;
      }
      inputMessageContent = {
        _: 'inputMessageText',
        text: {
          _: 'formattedText',
          text: msg.content,
          entities: [],
        },
        disable_web_page_preview: !preview,
      };
    } else if (msg.type == 'photo') {
      inputMessageContent = {
        _: 'inputMessagePhoto',
        photo: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          _: 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'animation') {
      inputMessageContent = {
        _: 'inputMessageAnimation',
        animation: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          _: 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'audio') {
      inputMessageContent = {
        _: 'inputMessageAudio',
        audio: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          _: 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'document') {
      inputMessageContent = {
        _: 'inputMessageDocument',
        document: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          _: 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'sticker') {
      inputMessageContent = {
        _: 'inputMessageSticker',
        sticker: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          _: 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'video') {
      inputMessageContent = {
        _: 'inputMessageVideo',
        video: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          _: 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'voice') {
      inputMessageContent = {
        _: 'inputMessageVoiceNote',
        voice_note: this.getInputFile(msg.content),
      };

      if (msg.extra && 'caption' in msg.extra) {
        inputMessageContent['caption'] = {
          _: 'formattedText',
          text: msg.extra.caption,
        };
      }
    } else if (msg.type == 'forward') {
      data = {
        _: 'forwardMessages',
        chat_id: msg.extra.conversation,
        from_chat_id: msg.conversation.id,
        message_ids: [msg.extra.message],
      };
    } else if (msg.type == 'native') {
      data = {
        _: msg.content,
        chat_id: msg.conversation.id,
      };

      if (msg.extra && 'title' in msg.extra) {
        data.title = msg.extra.title;
      }
      if (msg.extra && 'userId' in msg.extra) {
        data.user_id = msg.extra.userId;
      }

      if (msg.extra && 'customTitle' in msg.extra) {
        data.custom_title = msg.extra.customTitle;
      }

      if (msg.extra && 'photo' in msg.extra) {
        data.photo = this.getInputFile(msg.extra.photo);
      }

      if (msg.extra && 'description' in msg.extra) {
        data.description = msg.extra.description;
      }

      if (msg.extra && 'messageId' in msg.extra) {
        data.message_id = msg.extra.messageId;
      }

      if (msg.extra && 'stickerSetName' in msg.extra) {
        data.sticker_set_name = msg.extra.stickerSetName;
      }

      if (msg.extra && 'commands' in msg.extra) {
        data.commands = msg.extra.commands;
      }
    } else if (msg.type == 'api') {
      const params: { chat_id?; user_id?; custom_title?; photo?; message_id?; sticker_set_name?; commands? } = {
        chat_id: msg.conversation.id,
      };

      if (msg.extra && 'userId' in msg.extra) {
        params.user_id = msg.extra.userId;
      }

      if (msg.extra && 'customTitle' in msg.extra) {
        params.custom_title = msg.extra.customTitle;
      }

      if (msg.extra && 'photo' in msg.extra) {
        params.photo = msg.extra.photo;
      }

      if (msg.extra && 'messageId' in msg.extra) {
        params.message_id = msg.extra.messageId;
      }

      if (msg.extra && 'stickerSetName' in msg.extra) {
        params.sticker_set_name = msg.extra.stickerSetName;
      }

      if (msg.extra && 'commands' in msg.extra) {
        params.commands = msg.extra.commands;
      }

      await this.apiRequest(msg.content, params);
      await this.sendChatAction(msg.conversation.id, 'cancel');
      return;
    }

    if (inputMessageContent) {
      data = {
        _: 'sendMessage',
        chat_id: msg.conversation.id,
        input_message_content: inputMessageContent,
      };

      if (msg.reply) {
        data.reply_to_message_id = msg.reply.id;
      }
    }

    if (data) {
      if (msg.type == 'text' && data.input_message_content.text.text.length > 4096) {
        const texts = splitLargeMessage(data.input_message_content.text.text, 4096);
        for (const text of texts) {
          const split = { ...data };
          split.input_message_content.text = await this.formatTextEntities(msg, text);
          await this.serverRequest(data._, split, false, true);
        }
      } else {
        if (msg.type == 'text') {
          data.input_message_content.text = await this.formatTextEntities(msg);
        }
        const message = await this.serverRequest(data._, data, false, true);
        if (message && msg.type == 'text' && msg.extra.addPing) {
          this.pendingMessages.push({ msg, message });
        }
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

  async addPingToMessage(msg: Message, message: message): Promise<void> {
    const ping = message.date - msg.extra.originalMessage.date;
    let parseMode = null;

    if (msg.extra.format == 'HTML') {
      parseMode = 'textParseModeHTML';
    } else {
      parseMode = 'textParseModeMarkdown';
    }

    const text = await this.serverRequest('parseTextEntities', {
      text: message.content['text']['text'] + `\n<code>${ping.toFixed(3)}</code>`,
      parse_mode: {
        _: parseMode,
      },
    });

    const data = {
      _: 'editMessageText',
      chat_id: message.chat_id,
      message_id: message.id,
      input_message_content: {
        _: 'inputMessageText',
        text: text,
      },
    };
    await this.serverRequest(data._, data);
  }

  async formatTextEntities(msg: Message, text?: string): Promise<any> {
    if (!text) {
      text = msg.content;
    }
    if (msg.extra && 'format' in msg.extra) {
      let parseMode = null;
      let formatedText = null;

      if (msg.extra.format == 'HTML') {
        parseMode = 'textParseModeHTML';
      } else {
        parseMode = 'textParseModeMarkdown';
      }

      formatedText = await this.serverRequest('parseTextEntities', {
        text: text,
        parse_mode: {
          _: parseMode,
        },
      });

      if (formatedText) {
        return formatedText;
      } else {
        return {
          _: 'formattedText',
          text: text,
          entities: [],
        };
      }
    } else {
      return {
        _: 'formattedText',
        text: text,
        entities: [],
      };
    }
  }

  getInputFile(content: string): Record<string, unknown> {
    if (content.startsWith('/') || content.startsWith('C:\\')) {
      return {
        _: 'inputFileLocal',
        path: content,
      };
    } else if (content.startsWith('http')) {
      return {
        _: 'inputFileRemote',
        id: content,
      };
    } else if (isInt(content)) {
      return {
        _: 'inputFileId',
        id: content,
      };
    } else {
      return {
        _: 'inputFileRemote',
        id: content,
      };
    }
  }

  async requestProcessing(request: any, response: any): Promise<any> {
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
        response['message'].toLowerCase().indexOf(term) > -1 &&
        !hasTag(this.bot, request['chat_id'], 'resend:?') &&
        !hasTag(this.bot, request['chat_id'], 'fwd:?')
      ) {
        this.bot.sendAdminAlert(`Leaving chat: ${db.groups[request['chat_id']].title} [${request['chat_id']}]`);
        await this.bot.bindings.leaveConversation(request['chat_id']);
        otherError = false;
        break;
      }
    }

    if (response['message'].toLowerCase() == 'chat not found') {
      logger.info(`Chat not found: ${request['chat_id']}`);
      otherError = false;
    }

    if (response['message'].toLowerCase() == 'user_not_participant') {
      logger.info(`User not participant: ${request['chat_id']}`);
      otherError = false;
    }

    if (
      response['message'].toLowerCase() == 'bad request: file is too big' ||
      response['message'].toLowerCase() == 'invite_hash_expired'
    ) {
      logger.info(response['message']);
      otherError = false;
    }

    if (otherError) {
      this.bot.sendAlert(JSON.stringify(request, null, 4));
      this.bot.sendAlert(JSON.stringify(response, null, 4));
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
    return this.okToBoolean(
      await this.serverRequest('deleteMessages', {
        chat_id: chatId,
        message_ids: [messageId],
        revoke: true,
      }),
    );
  }

  async getFile(fileId: string | number, link?: boolean): Promise<string> {
    if (this.bot.user.isBot) {
      const params = {
        file_id: fileId,
      };
      const resp = await this.apiRequest('getFile', params);
      if (resp) {
        const result = (await resp.json()) as any;
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

  async createInviteLink(
    conversationId: string | number,
    name?: string,
    createsJoinRequest?: boolean,
    expirationDate?: number,
    memberLimit?: number,
  ): Promise<string> {
    const chatInviteLink = await this.serverRequest('createChatInviteLink', {
      chat_id: conversationId,
      name: name || 'Polaris',
      expiration_date: expirationDate || 0,
      member_limit: memberLimit || 0,
      creates_join_request: createsJoinRequest || true,
    });
    return chatInviteLink ? chatInviteLink.invite_link : null;
  }

  async checkInviteLink(inviteLink: string | number): Promise<boolean> {
    if (this.bot.user.isBot) {
      return null;
    }
    return this.okToBoolean(
      await this.serverRequest('checkChatInviteLink', {
        invite_link: inviteLink,
      }),
    );
  }

  async joinByInviteLink(inviteLink: string | number): Promise<boolean> {
    if (this.bot.user.isBot) {
      return null;
    }
    return this.okToBoolean(
      await this.serverRequest('joinChatByInviteLink', {
        invite_link: inviteLink,
      }),
    );
  }

  async inviteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    if (this.bot.user.isBot) {
      return null;
    }
    return this.okToBoolean(
      await this.serverRequest('addChatMember', {
        chat_id: conversationId,
        user_id: userId,
        forward_limit: 0,
      }),
    );
  }

  async promoteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    return this.okToBoolean(
      await this.serverRequest('setChatMemberStatus', {
        chat_id: conversationId,
        member_id: {
          _: 'messageSenderUser',
          user_id: userId,
        },
        status: { _: 'chatMemberStatusAdministrator' },
      }),
    );
  }

  async kickConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    return this.okToBoolean(
      await this.serverRequest(
        'setChatMemberStatus',
        {
          chat_id: conversationId,
          member_id: {
            _: 'messageSenderUser',
            user_id: userId,
          },
          status: { _: 'chatMemberStatusLeft' },
        },
        false,
        false,
        true,
      ),
    );
  }

  async leaveConversation(conversationId: string | number): Promise<boolean> {
    return this.okToBoolean(
      await this.serverRequest('leaveChat', {
        chat_id: conversationId,
      }),
    );
  }

  async banConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    return this.okToBoolean(
      await this.serverRequest(
        'banChatMember',
        {
          chat_id: conversationId,
          member_id: {
            _: 'messageSenderUser',
            user_id: userId,
          },
          revoke_messages: true,
        },
        false,
        false,
        true,
      ),
    );
  }

  async unbanConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    return this.okToBoolean(
      await this.serverRequest('setChatMemberStatus', {
        chat_id: conversationId,
        member_id: {
          _: 'messageSenderUser',
          user_id: userId,
        },
        status: { _: 'chatMemberStatusMember' },
      }),
    );
  }

  async renameConversation(conversationId: string | number, title: string): Promise<boolean> {
    return this.okToBoolean(
      await this.serverRequest('setChatTitle', {
        chat_id: conversationId,
        title: title,
      }),
    );
  }

  async changeConversationDescription(conversationId: string | number, description: string): Promise<boolean> {
    return this.okToBoolean(
      await this.serverRequest('setChatDescription', {
        chat_id: conversationId,
        description: description,
      }),
    );
  }

  async changeConversationPhoto(conversationId: string | number, photo: string): Promise<boolean> {
    return this.okToBoolean(
      await this.serverRequest('setChatPhoto', {
        chat_id: conversationId,
        photo: {
          _: 'inputChatPhotoStatic',
          photo: this.getInputFile(photo),
        },
      }),
    );
  }

  async createCall(conversationId: string | number, isVideo: boolean): Promise<boolean> {
    if (this.bot.user.isBot) {
      return null;
    }
    return await this.serverRequest('createCall', {
      chat_id: conversationId,
      protocol: {
        _: 'callProtocol',
        udp_p2p: true,
        udp_reflector: true,
      },
      is_video: isVideo || false,
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
