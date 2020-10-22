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

export class Config {
    name?: string;
    prefix?: string;
    locale?: string;
    owner?: string;
    plugins?: string|string[];
    excludedPlugins?: string[];
    translation?: string;
    bindings?: string;
    adminConversationId?: string;
    alertsConversationId?: string;
    apiKeys?: ApiKeys;

    constructor() {
        this.name = null,
        this.prefix = '/'
        this.locale = 'en_US'
        this.owner = null
        this.plugins = '*'
        this.excludedPlugins = [],
        this.translation = 'default',
        this.bindings = null,
        this.adminConversationId = null;
        this.alertsConversationId = null;
        this.apiKeys = {
            telegramBotToken: null,
            telegramApiHash: null,
            telegramAppId: null,
            databaseEncryptionKey: null
        }
    }

    static loadFromFile(path: string): Config {
        const file = readFileSync(path, 'utf-8');
        const config: Config = {... JSON.parse(file)};
        return config;
    }
}