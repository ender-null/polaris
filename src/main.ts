import { WebSocketServer, WebSocket } from 'ws';
import { BotSocket, Conversation, Message, WSBroadcast, WSInit, WSMessage } from './types';
import { catchException, logger, now } from './utils';
import { Bot } from './bot';
import { Database } from './database';

const wss: WebSocketServer = new WebSocketServer({ port: 8080 });

const close = () => {
  logger.info(`🟡 Closing connection for ${wss.clients.size} client(s)...`);

  if (!wss.clients.size) {
    process.exit();
  }

  wss.clients.forEach((socket) => {
    socket.close();
  });

  setTimeout(() => {
    wss.clients.forEach((socket) => {
      if (socket.readyState === socket.OPEN || socket.readyState === socket.CLOSING) {
        socket.terminate();
      }
    });
    process.exit();
  }, 10000);
};

process.on('SIGINT', () => close());
process.on('SIGTERM', () => close());
process.on('exit', () => {
  logger.info('❎ Exit process');
});

const bots: BotSocket = {};

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

    ws.on('message', (data: string) => {
      try {
        const json = JSON.parse(data);
        if (json.type === 'init') {
          const init: WSInit = json;
          bot = new Bot(ws, init.config, init.user, init.platform);
          bot.initPlugins();
          bots[bot.user.id] = ws;
          bot.initTranslations();
          logger.info(
            `🟢 Connected as ${bot.config.icon} ${bot.user.firstName} (@${bot.user.username}) [${bot.user.id}] on platform '${init.platform}'`,
          );
          bot.scheduleCronJobs();
        } else if (json.type === 'message') {
          const msg: WSMessage = json;
          bot.messagesHandler(msg.message);
        } else if (json.type === 'ping') {
          logger.debug('Ping');
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

export const db = new Database();
db.events.once('loaded', async () => {
  await start();
  db.events.on('update:configs', async () => {
    await start();
  });
});
db.init();
