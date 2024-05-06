import { ApiKeys } from './types';

export class Config {
  icon?: string;
  name: string;
  platform: string;
  prefix?: string;
  locale?: string;
  owner: string;
  enabled: boolean;
  plugins?: string | string[];
  excludedPlugins?: string[];
  translation?: string;
  alertsPlatform?: string;
  alertsTarget?: string;
  alertsConversationId?: string;
  adminConversationId?: string;
  apiKeys?: ApiKeys;

  constructor() {
    this.icon = '👤';
    this.name = null;
    this.prefix = '/';
    this.locale = 'en_US';
    this.owner = null;
    this.plugins = '*';
    this.excludedPlugins = [];
    this.translation = 'default';
    this.alertsPlatform = null;
    this.alertsTarget = null;
    this.alertsConversationId = null;
    this.adminConversationId = null;
    this.apiKeys = {
      telegramBotToken: null,
      telegramPhoneNumber: null,
      telegramApiHash: null,
      telegramAppId: null,
      databaseEncryptionKey: null,
      discordBotToken: null,
    };
  }
}
