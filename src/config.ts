import { readFileSync } from 'fs';
import { ApiKeys } from '.';
import { Instance } from './types';
import { merge } from './utils';

export class Config {
  icon?: string;
  name?: string;
  prefix?: string;
  locale?: string;
  owner?: string;
  enabled?: boolean;
  plugins?: string | string[];
  excludedPlugins?: string[];
  translation?: string;
  bindings?: string;
  adminConversationId?: string;
  alertsConversationId?: string;
  apiKeys?: ApiKeys;
  instances?: Instance[];

  constructor() {
    (this.icon = '👤'), (this.name = null), (this.prefix = '/');
    this.locale = 'en_US';
    this.owner = null;
    this.plugins = '*';
    (this.excludedPlugins = []),
      (this.translation = 'default'),
      (this.bindings = null),
      (this.adminConversationId = null);
    this.alertsConversationId = null;
    this.apiKeys = {
      telegramBotToken: null,
      telegramPhoneNumber: null,
      telegramApiHash: null,
      telegramAppId: null,
      databaseEncryptionKey: null,
      discordBotToken: null,
    };
    this.instances = null;
  }

  static loadFromFile(path: string): Config {
    try {
      const file = readFileSync(path, 'utf-8');
      const config: Config = { ...JSON.parse(file) };
      return config;
    } catch (error) {
      return null;
    }
  }

  static loadInstancesFromJSON(config: Config): Config[] {
    const configs = [];
    if (!config.instances) {
      configs.push(config);
    } else {
      for (const instance of Object.keys(config.instances)) {
        const iconfig = merge(config, config.instances[instance]);
        delete iconfig['instances'];
        configs.push(iconfig);
      }
    }
    return configs;
  }

  static loadInstancesFromFile(path: string): Config[] {
    const config = this.loadFromFile(path);
    const configs = this.loadInstancesFromJSON(config);
    return configs;
  }
}
