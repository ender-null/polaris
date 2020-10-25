import { Conversation, User } from '.';

export class Message {
  id: number | string;
  conversation: Conversation;
  sender: User | Conversation;
  content: string;
  type: string;
  date: number;
  reply: Message;
  extra: Extra;

  constructor(
    id: number | string,
    conversation: Conversation,
    sender: User | Conversation,
    content: string,
    type?: string,
    date?: number,
    reply?: Message,
    extra?: Extra,
  ) {
    this.id = id;
    this.conversation = conversation;
    this.sender = sender;
    this.content = content;
    this.type = type;
    this.date = date;
    this.reply = reply;
    this.extra = extra;
  }
}

export abstract class Extra extends Object {
  input?: string;
  inputReply?: string;
  format?: string;
  preview?: boolean;
  caption?: string;
}
