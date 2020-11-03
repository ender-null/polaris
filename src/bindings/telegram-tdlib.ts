import { Response } from 'node-fetch';
import { Client } from 'tdl';
import { TDLib } from 'tdl-tdlib-ffi';
import { message, ok, Update, user } from 'tdl/types/tdlib';
import { BindingsBase, Bot, Conversation, Message, User } from '..';
import { catchException, logger, sendRequest, splitLargeMessage } from '../utils';

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

  async apiRequest(method: string, params: Record<string, unknown> = {}): Promise<Response> {
    const url = `https://api.telegram.org/bot${this.bot.config.apiKeys.telegramBotToken}/${method}`;
    return sendRequest(url, params);
  }

  async serverRequest(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const query: any = {
      _: method,
      ...params,
    };
    return await this.client.invoke(query).catch((e) => catchException(e, this.bot));
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
    return new User(me.id, me.first_name, me.last_name, me.username);
  }

  async convertMessage(msg: message): Promise<Message> {
    const id = msg['id'];
    const extra = {};

    const rawChat = await this.serverRequest('getChat', { chat_id: msg.chat_id });
    const conversation = new Conversation(msg['chat_id']);
    let sender = null;
    if (rawChat && 'title' in rawChat) {
      conversation.title = rawChat.title;
    }
    if (msg['sender_user_id'] > 0) {
      const rawSender = await this.serverRequest('getUser', { user_id: msg.sender_user_id });
      sender = new User(msg.sender_user_id);
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
    } else if (msg.content._ == 'messagePhoto') {
      content = msg.content.photo.sizes[0].photo.remote.id;
      type = 'photo';
      if (msg.content.caption) {
        extra['caption'] = msg.content.caption;
      }
    } else if (msg.content._ == 'messageAnimation') {
      content = msg.content.animation.animation.remote.id;
      type = 'animation';
      if (msg.content.caption) {
        extra['caption'] = msg.content.caption;
      }
    } else if (msg.content._ == 'messageDocument') {
      content = msg.content.document.document.remote.id;
      type = 'document';
      if (msg.content.caption) {
        extra['caption'] = msg.content.caption;
      }
    } else if (msg.content._ == 'messageAudio') {
      content = msg.content.audio.audio.remote.id;
      type = 'audio';
      if (msg.content.caption) {
        extra['caption'] = msg.content.caption;
      }
    } else if (msg.content._ == 'messageVideo') {
      content = msg.content.video.video.remote.id;
      type = 'video';
      if (msg.content.caption) {
        extra['caption'] = msg.content.caption;
      }
    } else if (msg.content._ == 'messageVoiceNote') {
      content = msg.content.voice_note.voice.remote.id;
      type = 'voice';
      if (msg.content.caption) {
        extra['caption'] = msg.content.caption;
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

    const date = msg['date'];
    const reply = null;
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
    this.sendChatAction(+msg.conversation.id, msg.type);
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
    }

    if (inputMessageContent) {
      data = {
        '@type': 'sendMessage',
        chat_id: msg.conversation.id,
        input_message_content: inputMessageContent,
      };

      if (msg.reply) {
        data['reply_to_message_id'] = msg.reply;
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
        this.sendChatAction(+msg.conversation.id, 'cancel');
      }
    }
  }

  async sendChatAction(conversationId: number, type = 'text'): Promise<ok> {
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

    return await this.serverRequest('sendChatAction', {
      chat_id: conversationId,
      action: { _: action },
    });
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
    } else if (content.startsWith(content)) {
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

  async getChatAdministrators(conversationId: string | number): Promise<User[]> {
    const result = await this.serverRequest('getChatAdministrators', {
      chat_id: conversationId,
    });

    const admins = [];
    if (result && 'administrators' in result) {
      for (const member of result['administrators']) {
        const user = new User(member['user_id']);

        const request = this.serverRequest('getUser', {
          user_id: user.id,
        });
        const rawUser = request;

        if (rawUser) {
          user.isBot = rawUser['type']['@type'] == 'userTypeBot';
          if ('first_name' in rawUser) {
            user.firstName = String(rawUser['first_name']);
          }
          if ('last_name' in rawUser) {
            user.lastName = String(rawUser['last_name']);
          }
          if ('username' in rawUser) {
            user.username = String(rawUser['username']);
          }
        }
        admins.push(user);
      }
    }
    return admins;
  }
}
