import { MongoClient } from 'mongodb';
import { WebSocket, WebSocketServer } from 'ws';
import { Bot } from './bot';
import { BotSet, MongoDatabases, WSInit, WSMessage, WSPong } from './types';
import { catchException, logger, trackEvent } from './utils';
import { v4 } from 'uuid';

let mongo: MongoClient;
export const sessionId = v4();
export const wss: WebSocketServer = new WebSocketServer({ port: 8080 });

const close = () => {
  logger.info(`🟡 Closing connection for ${wss.clients.size} client(s)...`);

  if (!wss.clients.size) {
    process.exit();
  }

  wss.clients.forEach((socket) => {
    socket.terminate();
  });

  mongo.close();
  process.exit();
};

process.on('SIGINT', () => close());
process.on('SIGTERM', () => close());
process.on('SIGUSR1', () => close());
process.on('SIGUSR2', () => close());
process.on('exit', () => {
  logger.info('❎ Exit process');
});

if (!process.env.MONGODB_URI) {
  logger.warn(`Missing env variable MONGODB_URI`);
  close();
}

export const bots: BotSet = {};
export const db: MongoDatabases = {};

const start = () => {
  logger.info(`🟡 WebSocket server waiting for connections...`);
  wss.on('connection', (ws: WebSocket) => {
    logger.info('🟢 Client connected');
    let bot: Bot;

    ws.on('error', logger.error);

    ws.on('close', (code: number) => {
      if (code === 1005) {
        logger.info('🔴 Disconnected');
      } else if (code === 1006) {
        logger.info('🔴 Terminated');
      }
    });

    ws.on('open', (code: number) => {
      logger.info('open: %s', code);
    });

    ws.on('message', async (data: string) => {
      try {
        const json = JSON.parse(data);
        if (json.type === 'init') {
          const init: WSInit = json;
          bot = new Bot(ws, init.config, init.user, init.platform);
          if (!db[init.platform]) {
            db[init.platform] = mongo.db(init.platform);
          }
          bot.initPlugins();
          bots[bot.user.id] = bot;
          await bot.initTranslations();
          logger.info(
            `✅ Connected as ${bot.config.icon} ${bot.user.firstName} (@${bot.user.username}) [${bot.user.id}] on platform '${init.platform}'`,
          );
          trackEvent('connected', {
            platform: init.platform,
            id: bot.user.id,
            username: bot.user.username,
          });
          bot.scheduleCronJobs();
        } else if (json.type === 'message') {
          const msg: WSMessage = json;
          trackEvent('message', {
            platform: msg.platform,
            type: msg.message.type,
            group: Boolean(String(msg.message.conversation.id).startsWith('-')),
          });
          if (bot) {
            bot.messagesHandler(msg.message);
          }
        } else if (json.type === 'ping') {
          logger.debug('Ping');
          const pong: WSPong = {
            bot: bot ? bot.config.name : '?',
            platform: bot ? bot.platform : '?',
            type: 'pong',
          };
          ws.send(JSON.stringify(pong));
        } else if (json.type === 'broadcast' || json.type === 'redirect') {
          bot.sendBroadcast(json).then();
        } else {
          logger.warning(`Unsupported data: ${data}`);
        }
      } catch (error) {
        catchException(error);
      }
    });
  });
};

MongoClient.connect(process.env.MONGODB_URI, {
  appName: 'polaris',
}).then(async (client: MongoClient) => {
  logger.info(`✅ Connected successfully to database`);

  db['polaris'] = client.db('polaris');
  mongo = client;

  await start();
});
