import { Config } from '.';

export class ErrorMessages {
  adminRequired?: string;
  apiLimitExceeded?: string;
  connectionError?: string;
  disabled?: string;
  downloadFailed?: string;
  exceptionFound?: string;
  failed?: string;
  groupOnly?: string;
  idiotKicked?: string;
  invalidArgument?: string;
  missingId?: string;
  missingParameter?: string;
  needsReply?: string;
  noResults?: string;
  notImplemented?: string;
  permissionRequired?: string;
  privateOnly?: string;
  spammerDetected?: string;
  unableDoActionToAdmin?: string;

  constructor() {
    this.adminRequired = 'Only works with <b>admin privileges</b>';
    this.apiLimitExceeded = 'The API limits have been exceeded';
    this.connectionError = 'Connection error';
    this.disabled = 'That feature is disabled';
    this.downloadFailed = 'Download failed';
    this.exceptionFound = 'Exception found';
    this.failed = 'Failed';
    this.groupOnly = 'Only works with <b>groups</b>';
    this.idiotKicked = 'Idiot kicked';
    this.invalidArgument = 'Invalid argument';
    this.missingId = 'Missing ID';
    this.missingParameter = 'Missing parameter';
    this.needsReply = 'Only works with <b>replies</b>';
    this.noResults = 'No results';
    this.notImplemented = 'Function not implemented';
    this.permissionRequired = 'Permission required';
    this.privateOnly = 'Only works in <b>private</b>';
    this.spammerDetected = 'Spammer detected, proceed to commit death';
    this.unableDoActionToAdmin = 'Unable to do action to <b>admin</b>';
  }
}

export interface ApiKeys {
  telegramPhoneNumber?: string;
  telegramBotToken?: string;
  telegramApiHash?: string;
  telegramAppId?: number;
  databaseEncryptionKey?: string;
  discordBotToken?: string;
  discordClientId?: number;
  blizzardClientId?: string;
  blizzardClientSecret?: string;
  catApi?: string;
  giphy?: string;
  googleDeveloperConsole?: string;
  lastfm?: string;
  openWeather?: string;
  tenor?: string;
  riotApi?: string;
  wolframAlpha?: string;
  matrixAccessToken?: string;
  matrixHomeserverUrl?: string;
  matrixUsername?: string;
  matrixPassword?: string;
  facebookPageAccessToken?: string;
  facebookVerifyToken?: string;
  twitterConsumerKey?: string;
  twitterConsumerSecret?: string;
  twitterAccessTokenKey?: string;
  twitterAccessTokenSecret?: string;
}

export interface Instance {
  translation?: string;
  bindings?: string;
  owner?: string;
  adminConversationId?: string;
  alertsConversationId?: string;
  plugins?: string | string[];
  apiKeys?: ApiKeys;
}

export abstract class Command {
  command?: string;
  friendly?: string;
  shortcut?: string;
  aliases?: string[];
  parameters?: Parameter[];
  hidden?: boolean;
  description?: string;
  keepDefault?: boolean;
  skipHelp?: boolean;
  alwaysEnabled?: boolean;

  constructor() {
    this.friendly = null;
    this.shortcut = null;
    this.parameters = null;
    this.hidden = false;
    this.description = null;
    this.keepDefault = false;
    this.alwaysEnabled = false;
  }
}

export abstract class Parameter {
  name: string;
  required: boolean;
}

export class User {
  id: number | string;
  firstName: string;
  lastName: string;
  username: string;
  isBot: boolean;

  constructor(id: number | string, firstName?: string, lastName?: string, username?: string, isBot = false) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.username = username;
    this.isBot = isBot;
  }
}

export class Conversation {
  id: number | string;
  title: string;

  constructor(id: number | string, title?: string) {
    this.id = id;
    this.title = title;
  }
}

export class ConversationInfo extends Conversation {}

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

export class HTTPResponseError extends Error {
  response: Response;
  constructor(response: Response) {
    super(`Failed HTTP request to '${response.url}' with status ${response.status} (${response.statusText})`);
    this.response = response;
  }
}

export interface Extra {
  originalMessage?: any;
  input?: string;
  inputReply?: string;
  addPing?: boolean;
  format?: string;
  preview?: boolean;
  caption?: string;
  message?: number | string;
  title?: string;
  description?: string;
  photo?: string;
  conversation?: number | string;
  commands?: string;
  stickerSetName?: string;
  messageId?: number | string;
  userId?: number | string;
  fromChatId?: number | string;
  customTitle?: string;
  urls?: string[];
  mentions?: string[];
  hashtags?: string[];
  viaBotUserId?: number | string;
  restrictionReason?: string;
  replyMarkup?: any;
}

export interface CoordinatesResult {
  status: string;
  lat: number;
  lng: number;
  locality: string;
  country: string;
}

export interface WSData {
  bot: string;
  platform: string;
  type: string;
}

export interface WSInit extends WSData {
  type: 'init';
  user: User;
  config: Config;
}

export interface WSMessage extends WSData {
  type: 'message';
  message: Message;
}

export interface DatabaseUser {
  first_name?: string;
  last_name?: string;
  username?: string;
  nick?: string;
  description?: string;
  is_bot?: boolean;
  is_scam?: boolean;
}

export interface DatabaseConversation {
  title?: string;
  description?: string;
  username?: string;
  invite_link?: string;
  member_count?: number;
  is_scam?: boolean;
  is_channel?: boolean;
  linked_chat_id?: number;
  date?: number;
  restriction_reason?: string;
}

export interface DatabaseReminder {
  alarm?: number;
  chatId?: number | string;
  userId?: number | string;
  text?: string;
  firstName?: string;
  username?: string;
  bot?: number | string;
}

export interface DatabasePin {
  content?: string;
  creator?: number | string;
  type?: string;
  bot?: number | string;
}

export interface DatabasePoleList {
  [id: string]: DatabasePole;
}

export interface DatabasePole {
  pole?: number | string;
  subpole?: number | string;
  fail?: number | string;
  iron?: number | string;
  canaria?: number | string;
  andaluza?: number | string;
}

export interface SortedPole extends DatabasePole {
  uid?: number | string;
  points?: number;
}

export interface iString {
  [id: string]: string;
}

export interface iStringNested {
  [id: string]: iString;
}

export interface iConfig {
  [id: string]: Config;
}

export interface iUser {
  [id: string]: DatabaseUser;
}

export interface iConversation {
  [id: string]: DatabaseConversation;
}

export interface iPin {
  [id: string]: DatabasePin;
}

export interface iPole {
  [id: string]: DatabasePoleList;
}

export interface iReminder {
  [id: string]: DatabaseReminder;
}

export interface iTag {
  [id: string]: iString;
}

export interface PluginTranslation {
  commands?: Command[];
  strings?: iString;
  data?: iString;
}

export interface iPluginTranslation {
  [id: string]: PluginTranslation;
}

export interface GroupAdministration {
  alias?: string;
  link?: string;
  motd?: string;
  public?: boolean;
  rules?: iString;
}

export interface iGroupAdministration {
  [id: string]: GroupAdministration;
}

export interface Translation {
  extends?: string;
  errors?: ErrorMessages;
  plugins?: iPluginTranslation;
}

export interface iTranslation {
  [id: string]: Translation;
}
