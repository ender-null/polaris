import { htmlToText } from 'html-to-text';
import { AutojoinRoomsMixin, LogLevel, LogService, MatrixClient, SimpleFsStorageProvider } from 'matrix-bot-sdk';
import { BindingsBase, Bot, Conversation, ConversationInfo, Message, User } from '..';

export class MatrixBindings extends BindingsBase {
  client: MatrixClient;
  joinedRooms: string[];
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
    this.client.on('room.message', (roomId: string, event) => this.eventHandler(roomId, event));
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
    const sender = new User(this.getSafeUsername(msg.sender), senderRaw.displayname, null, msg.sender.slice(1));
    const name = await this.client.getRoomStateEvent(roomId, 'm.room.name', '');
    const conversation = new Conversation('-' + this.getSafeUsername(roomId), name.name);
    return new Message(id, conversation, sender, content, type, date, reply, extra);
  }

  async sendMessage(msg: Message): Promise<void> {
    let data = {};
    let content = msg.content;
    let url;

    if (msg.type != 'text') {
      content = null;
      if (msg.extra && msg.extra.caption) {
        content = msg.extra.caption;
      }
      if (msg.content.startsWith('http')) {
        url = await this.client.uploadContentFromUrl(msg.content);
      } else if (msg.content.startsWith('/') || msg.content.startsWith('C:\\')) {
        url = await this.client.uploadContent(Buffer.from(msg.content));
      }
      this.client.sendMessage(this.getMatrixUsername(msg.conversation.id), {
        msgtype: this.getMessageType(msg.type),
        url: url,
        body: '',
      });
    }

    if (content) {
      if (msg.extra && 'format' in msg.extra && msg.extra.format == 'HTML') {
        content = content.replace(/(\r\n|\r|\n)/g, '<br>');
        content = content.replace(/(\t)/g, ' ');
        data = {
          body: htmlToText(content, { wordwrap: false }),
          msgtype: 'm.text',
          format: 'org.matrix.custom.html',
          formatted_body: content,
        };
      } else {
        data = {
          msgtype: 'm.text',
          body: content,
        };
      }
      this.client.sendMessage(this.getMatrixUsername(msg.conversation.id), data);
    }
  }

  getSafeUsername(username: string): string {
    if (typeof username != 'string') {
      username = String(username);
    }
    if (username.startsWith('@')) {
      username = username.slice(1);
    }
    username = username.replace(/\./g, '!');
    return username;
  }

  getMatrixUsername(id: string | number): string {
    if (typeof id != 'string') {
      id = String(id);
    }
    if (id.startsWith('-')) {
      id = id.slice(2);
    }
    id = '!' + id.replace(/!/g, '.');
    return id;
  }

  getMessageType(type: string): string {
    if (type == 'photo') {
      return 'm.image';
    } else if (type == 'document') {
      return 'm.file';
    } else if (type == 'audio') {
      return 'm.audio';
    } else if (type == 'video') {
      return 'm.video';
    } else if (type == 'location') {
      return 'm.location';
    }
    return 'm.notice';
  }

  async stop(): Promise<void> {
    this.client.removeAllListeners('room.message');
    this.bot.outbox.removeAllListeners('message');
    this.bot.status.emit('stopped');
  }
  async getMe(): Promise<User> {
    const userId = await this.client.getUserId();
    const profile = await this.client.getUserProfile(userId);
    return new User(this.getSafeUsername(userId), profile.displayname, null, userId.slice(1), false);
  }
  async getMessage(chatId: string | number, messageId: string | number, ignoreReply?: boolean): Promise<Message> {
    console.debug(chatId, messageId, ignoreReply);
    return null;
  }
  async deleteMessage(chatId: string | number, messageId: string | number): Promise<boolean> {
    console.debug(chatId, messageId);
    return null;
  }
  async getFile(fileId: string | number, link?: boolean): Promise<string> {
    console.debug(fileId, link);
    return null;
  }
  async checkInviteLink(inviteLink: string | number): Promise<boolean> {
    console.debug(inviteLink);
    return null;
  }
  async joinByInviteLink(inviteLink: string | number): Promise<boolean> {
    console.debug(inviteLink);
    return null;
  }
  async inviteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.debug(conversationId, userId);
    return null;
  }
  async promoteConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.debug(conversationId, userId);
    return null;
  }
  async kickConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.debug(conversationId, userId);
    return null;
  }
  async leaveConversation(conversationId: string | number): Promise<boolean> {
    console.debug(conversationId);
    return null;
  }
  async banConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.debug(conversationId, userId);
    return null;
  }
  async unbanConversationMember(conversationId: string | number, userId: string | number): Promise<boolean> {
    console.debug(conversationId, userId);
    return null;
  }
  async renameConversation(conversationId: string | number, title: string): Promise<boolean> {
    console.debug(conversationId, title);
    return null;
  }
  async changeConversationDescription(conversationId: string | number, description: string): Promise<boolean> {
    console.debug(conversationId, description);
    return null;
  }
  async changeConversationPhoto(conversationId: string | number, photo: string): Promise<boolean> {
    console.debug(conversationId, photo);
    return null;
  }
  async conversationInfo(conversationId: string | number): Promise<ConversationInfo> {
    console.debug(conversationId);
    return null;
  }
  async getChatAdministrators(conversationId: string | number): Promise<User[]> {
    console.debug(conversationId);
    return [];
  }
}
