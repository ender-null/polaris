import { readFileSync } from 'fs';

export interface ApiKeys {
  telegramBotToken?: string;
  telegramApiHash?: string;
  telegramAppId?: number;
  databaseEncryptionKey?: string;
  discordBotToken?: string;
  battleNet?: string;
  catApi?: string;
  giphy?: string;
  googleDeveloperConsole?: string;
  lastfm?: string;
  openWeather?: string;
  riotApi?: string;
  wolframAlpha?: string;
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

export class Config {
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
    (this.name = null), (this.prefix = '/');
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
      telegramApiHash: null,
      telegramAppId: null,
      databaseEncryptionKey: null,
      discordBotToken: null,
    };
    this.instances = null;
  }

  static loadFromFile(path: string): Config {
    const file = readFileSync(path, 'utf-8');
    const config: Config = { ...JSON.parse(file) };
    return config;
  }

  static loadInstancesFromJSON(config: Config): Config[] {
    const configs = [];
    if (!config.instances) {
      configs.push(config);
    } else {
      for (const instance of Object.keys(config.instances)) {
        const iconfig = {
          ...config,
          ...config.instances[instance],
        };
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
