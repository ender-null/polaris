import { htmlToText } from 'html-to-text';
import { AutojoinRoomsMixin, LogLevel, LogService, MatrixClient, SimpleFsStorageProvider } from 'matrix-bot-sdk';
import { BindingsBase, Bot, Conversation, ConversationInfo, Message, User } from '..';
import { usernameSanitize } from '../utils';

export class MatrixBindings extends BindingsBase {
  client: MatrixClient;
  constructor(bot: Bot) {
    super(bot);
  }

  async start(): Promise<void> {
    // We'll want to make sure the bot doesn't have to do an initial sync every
    // time it restarts, so we need to prepare a storage provider. Here we use
    // a simple JSON database.
    const storage = new SimpleFsStorageProvider(`data/${this.bot.config.name}.json`);

    // LogLevel has type safe settings via e.g. LogLevel.ERROR
    LogService.setLevel(LogLevel.WARN);

    // Now we can create the client and set it up to automatically join rooms.
    this.client = new MatrixClient(
      this.bot.config.apiKeys.matrixHomeserverUrl,
      this.bot.config.apiKeys.matrixAccessToken,
      storage,
    );
    AutojoinRoomsMixin.setupOnClient(this.client);
    this.client.on('room.event', (roomId: string, event) => this.eventHandler(roomId, event));
    this.bot.outbox.on('message', (msg: Message) => this.sendMessage(msg));
    this.client.start().then(() => this.bot.status.emit('started'));
  }

  async eventHandler(roomId: string, event) {
    // Don't handle events that don't have contents (they were probably redacted)
    if (!event.content) return;

    // Don't handle non-text events
    if (event.content.msgtype !== 'm.text') return;

    // We never send `m.text` messages so this isn't required, however this is
    // how you would filter out events sent by the bot itself.
    if (event.sender === (await this.client.getUserId())) return;
    const msg = await this.convertMessage(roomId, event);
    if (msg) {
      this.bot.inbox.emit('message', msg);
    }
  }

  async convertMessage(roomId: string, msg): Promise<Message> {
    const id = msg.event_id;
    const extra = {};
    const content = msg.content.body;
    const type = 'text';
    const date = msg.origin_server_ts;
    const reply = null;
    const senderRaw = await this.client.getUserProfile(msg.sender);
    const sender = new User(msg.sender, senderRaw.displayname, msg.sender);
    const conversation = new Conversation(roomId, roomId);
    return new Message(id, conversation, sender, content, type, date, reply, extra);
  }

  async sendMessage(msg: Message): Promise<void> {
    if (msg.extra && 'format' in msg.extra && msg.extra.format == 'HTML') {
      this.client.sendMessage(String(msg.conversation.id), {
        body: htmlToText(msg.content, { wordwrap: false }),
        msgtype: 'm.text',
        format: 'org.matrix.custom.html',
        formatted_body: msg.content,
      });
    } else {
      this.client.sendMessage(String(msg.conversation.id), {
        msgtype: 'm.text',
        body: msg.content,
      });
    }
  }

  stop(): Promise<void> {
    return null;
  }
  async getMe(): Promise<User> {
    const userId = await this.client.getUserId();
    const profile = await this.client.getUserProfile(userId);
    return new User(usernameSanitize(userId), profile.displayname, null, usernameSanitize(userId), false);
  }
  getMessage(chatId: string | number, messageId: string | number, ignoreReply?: boolean): Promise<Message> {
    throw new Error('Method not implemented.');
  }
  deleteMessage(chatId: string | number, messageId: string | number): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  getFile(fileId: string | number, link?: boolean): Promise<string> {
    throw new Error('Method not implemented.');
  }
  checkInviteLink(inviteLink: string | number): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  joinByInviteLink(inviteLink: string | number): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  inviteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  promoteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  kickConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  leaveConversation(conversationId: string | number): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  banConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  unbanConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  renameConversation(conversationId: string | number, title: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  changeConversationDescription(conversationId: string | number, description: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  changeConversationPhoto(conversationId: string | number, photo: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  conversationInfo(conversationId: string | number): Promise<ConversationInfo> {
    throw new Error('Method not implemented.');
  }
  getChatAdministrators(conversationId: string | number): Promise<User[]> {
    throw new Error('Method not implemented.');
  }
}
