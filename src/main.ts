import { WebSocketServer, WebSocket } from 'ws';
import { BotSocket, Message, MongoDatabases, WSBroadcast, WSInit, WSMessage, WSPong } from './types';
import { catchException, logger, now } from './utils';
import { Bot } from './bot';
import { MongoClient } from 'mongodb';

let mongo: MongoClient;
const wss: WebSocketServer = new WebSocketServer({ port: 8080 });

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

const bots: BotSocket = {};
export const db: MongoDatabases = {};

const start = () => {
  logger.info('🟡 WebSocket server waiting for connections...');
  wss.on('connection', (ws: WebSocket) => {
    logger.info('🟢 Connected');
    let bot: Bot;

    ws.on('error', console.error);

    ws.on('close', (code: number) => {
      if (code === 1005) {
        logger.info('🔴 Disconnected');
      } else if (code === 1006) {
        logger.info('🔴 Terminated');
      }
    });

    ws.on('open', (code: number) => {
      console.log('open: %s', code);
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
          bots[bot.user.id] = ws;
          await bot.initTranslations();
          logger.info(
            `🟢 Connected as ${bot.config.icon} ${bot.user.firstName} (@${bot.user.username}) [${bot.user.id}] on platform '${init.platform}'`,
          );
          bot.scheduleCronJobs();
        } else if (json.type === 'message') {
          const msg: WSMessage = json;
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
        } else if (json.type === 'broadcast') {
          const broadcast: WSBroadcast = json;
          const message: WSMessage = {
            bot: broadcast.bot,
            platform: broadcast.platform,
            type: 'message',
            message: new Message(
              null,
              broadcast.message.conversation,
              bot.user,
              broadcast.message.content,
              broadcast.message.type,
              now(),
              null,
              broadcast.message.extra,
            ),
          };
          if (Array.isArray(broadcast.target)) {
            bot.broadcastHandler(broadcast.message);
            broadcast.target.forEach((target) => bots[target].send(JSON.stringify(message)));
          } else if (broadcast.target === '*' || broadcast.target === 'all') {
            wss.clients.forEach((client) => {
              if (client !== ws) {
                bot.broadcastHandler(broadcast.message);
                client.send(JSON.stringify(message));
              }
            });
          } else {
            bot.broadcastHandler(broadcast.message);
            bots[broadcast.target].send(JSON.stringify(message));
          }
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

/*export const db = new Database();
db.events.once('loaded', async () => {
  await start();
  db.events.on('update:configs', async () => {
    await start();
  });
});
db.init();
*/
