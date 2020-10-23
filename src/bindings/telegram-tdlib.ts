import { Client } from 'tdl';
import { TDLib } from 'tdl-tdlib-ffi';
import { Update, updateNewMessage } from 'tdl/types/tdlib';
import { Conversation, Message, User } from '..';
import { BindingsBase } from '../bindings';
import { Bot } from '../bot';
import { logger } from '../main';

export class TelegramTDlibBindings extends BindingsBase {
  client: Client;
  constructor(bot: Bot) {
    super(bot);
    this.client = new Client(new TDLib('bin/libtdjson.so'), {
      apiId: this.bot.config.apiKeys.telegramAppId,
      apiHash: this.bot.config.apiKeys.telegramApiHash,
      databaseDirectory: '/home/ender/.tdlib_files/' + this.bot.config.name,
      databaseEncryptionKey: this.bot.config.apiKeys.databaseEncryptionKey,
      filesDirectory: '/home/ender/.tdlib_files/' + this.bot.config.name,
      verbosityLevel: 2,
      tdlibParameters: {
        application_version: '1.0',
        device_model: 'polaris.js',
      },
    });
  }

  async start(): Promise<void> {
    await this.client.connectAndLogin(() => ({
      type: 'bot',
      getToken: (retry) =>
        retry ? Promise.reject('Token is not valid') : Promise.resolve(this.bot.config.apiKeys.telegramBotToken), // Token from @BotFather
    }));

    this.client.on('update', await this.onMessageReceive);
    this.client.on('error', console.error);
  }

  async stop(): Promise<void> {
    logger.info('stop');
  }

  async getMe(): Promise<User> {
    return new User(0);
  }

  async onMessageReceive(update: Update): Promise<void> {
    if (update._ == 'updateNewMessage') {
      const msg = await this.convertMessage(update);
      this.bot.inbox.emit('message', msg);
    }
  }

  async convertMessage(msg: updateNewMessage): Promise<Message> {
    const id = msg['id'];
    const extra = {};
    const conversation = new Conversation(msg['chat_id']);
    let sender;
    if (msg['sender_user_id'] > 0) {
      const rawSender = await this.serverRequest('getUser', { user_id: msg['sender_user_id'] });

      sender = new User(msg['sender_user_id']);
      if ('first_name' in rawSender) {
        sender.firstName = String(rawSender['first_name']);
      }
      if ('last_name' in rawSender) {
        sender.lastName = String(rawSender['last_name']);
      }
      if ('username' in rawSender) {
        sender.username = String(rawSender['username']);
      }
    } else {
      sender = new User(conversation.id, conversation.title);
    }
    const content = 'content';
    const type = 'text';
    const date = msg['date'];
    const reply = null;
    return new Message(id, conversation, sender, content, type, date, reply, extra);
  }

  async serverRequest(method: string, params = {}): Promise<any> {
    const query: any = {
      _: method,
      ...params,
    };
    return await this.client.execute(query);
  }
}
