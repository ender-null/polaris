import http from 'http';
import { Bot, Config, Database } from '.';
import { catchException, logger } from './utils';

const bots: Bot[] = [];

export async function stop(): Promise<void> {
  let pending = bots.length;
  logger.info(`Stopping ${pending} bots...`);
  for (const bot of bots) {
    try {
      await bot.stop();
    } catch (e) {
      logger.error(e.message);
    }

    pending -= 1;
    if (pending == 0) {
      logger.info(`Closed all bots, exiting process. PID: ${process.pid}`);
      process.exit();
    } else {
      logger.info(`Pending ${pending} bots...`);
    }
  }
}

process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());

http
  .createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    const path = req.url.split('/');
    req.on('data', (data) => {
      let received = false;
      for (const bot of bots) {
        if (bot.config.name == path[1]) {
          bot.inbox.emit('webhook', data);
          res.write(`webhook@${bot.user.username}\n`);
          received = true;
        }
      }
      if (received) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
      }
    });
    res.end();
  })
  .listen(1984);

export const db = new Database();
db.events.on('update:configs', async () => {
  logger.info('Configs updated');
  if (Array.isArray(bots) && bots.length > 0) {
    for (const bot of bots) {
      await bot.stop();
    }
  }
  for (const key of Object.keys(db.configs)) {
    const configs = Config.loadInstancesFromJSON(db.configs[key]);
    for (const config of configs) {
      const bot = new Bot(config);
      if (config.enabled) {
        process.on('unhandledRejection', (exception: Error) => {
          catchException(exception, bot);
        });
        await bot.start();
      }
      bots.push(bot);
    }
  }
});
db.init();
