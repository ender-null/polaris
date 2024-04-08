import { WebSocketServer, WebSocket } from 'ws';
import { WSInit, WSMessage } from './types';
import { catchException, logger } from './utils';
import { Bot } from './bot';
import os from 'os';
import { Database } from './database';

const wss: WebSocketServer = new WebSocketServer({ port: 8080 });

const forceClose = () => {
  logger.info(`🟡 Force close...`);

  wss.clients.forEach((socket) => {
    if (socket.readyState === socket.OPEN || socket.readyState === socket.CLOSING) {
      socket.terminate();
    }
  });
  process.exit();
};

const close = () => {
  logger.info(`🟡 Closing connection for ${wss.clients.size} client(s)...`);

  if (!wss.clients.size) {
    process.exit();
  }

  wss.clients.forEach((socket) => {
    socket.close();
  });

  setTimeout(() => {
    forceClose();
  }, 10000);
};

process.on('SIGKILL', () => forceClose());
process.on('SIGINT', () => close());
process.on('SIGTERM', () => close());
process.on('exit', () => {
  logger.info('❎ Exit process');
});

const bots = [];

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
          bot = new Bot(ws, init.config, init.user);
          bot.initPlugins();
          bots.push(bot);
          logger.info(
            `🟢 Connected as ${bot.config.icon} ${bot.user.firstName} (@${bot.user.username}) [${bot.user.id}] from ${os.hostname}`,
          );
        } else if (json.type === 'message') {
          const msg: WSMessage = json;
          bot.messagesHandler(msg.message);
        } else if (json.type === 'ping') {
          logger.debug('Ping');
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
