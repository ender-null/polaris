import { Client } from 'tdl';
import { TDLib } from 'tdl-tdlib-ffi';
import { message, Update, user } from 'tdl/types/tdlib';
import { BindingsBase, Bot, Conversation, Message, User } from '..';
import { logger } from '../main';

export class TelegramTDlibBindings extends BindingsBase {
  client: Client;
  constructor(bot: Bot) {
    super(bot);
    this.client = new Client(new TDLib(), {
      apiId: this.bot.config.apiKeys.telegramAppId,
      apiHash: this.bot.config.apiKeys.telegramApiHash,
      databaseDirectory: `${__dirname}/.tdlib_files/${this.bot.config.name}`,
      databaseEncryptionKey: this.bot.config.apiKeys.databaseEncryptionKey,
      filesDirectory: `${__dirname}/.tdlib_files/${this.bot.config.name}`,
      verbosityLevel: 1,
      tdlibParameters: {
        application_version: '1.0',
        device_model: 'polaris.js',
      },
    });
  }

  async serverRequest(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const query: any = {
      _: method,
      ...params,
    };
    return await this.client.invoke(query);
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
    logger.info('stop');
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
    if (msg.content) {
      await this.serverRequest('sendMessage', {
        chat_id: msg.conversation.id,
        input_message_content: {
          _: 'inputMessageText',
          text: {
            _: 'formattedText',
            text: msg.content,
          },
        },
      });
    }
  }
}
