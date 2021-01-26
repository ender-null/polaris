import http from 'http';
import { Bot, Config, Database } from '.';
import { catchException, logger } from './utils';

// global.Promise = require('bluebird');

const bots: Bot[] = [];

export async function stop(exit?: boolean): Promise<void> {
  let pending = bots.length;
  logger.info(`🟡 Stopping ${pending} bots...`);
  for (const bot of bots) {
    try {
      await bot.stop();
    } catch (e) {
      logger.error(e.message);
    }

    pending -= 1;
    if (pending == 0) {
      if (exit) {
        logger.info('✅ Closed all bots, exiting process');
        process.exit();
      } else {
        logger.info('✅ Closed all bots');
        process.exit();
      }
    } else {
      logger.info(`⏳ Pending ${pending} bots...`);
    }
  }
}

export async function start(): Promise<void> {
  if (Array.isArray(bots) && bots.length > 0) {
    this.stop();
  }
  const config = Config.loadFromFile('config.json');
  const configs = [];
  if (config) {
    configs.push(config);
  } else {
    for (const key of Object.keys(db.configs)) {
      configs.push(...Config.loadInstancesFromJSON(db.configs[key]));
    }
  }

  for (const config of configs) {
    if (config.enabled) {
      const bot = new Bot(config);
      process.on('unhandledRejection', (exception: Error) => {
        catchException(exception, bot);
      });
      await bot.start();
      bots.push(bot);
    }
  }
  logger.info(`✅ Started ${configs.length} bots`);
}

process.once('SIGINT', () => stop(true));
process.once('SIGTERM', () => stop(true));

http
  .createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    const path = req.url.split('/');
    req.on('data', (data: string) => {
      for (const bot of bots) {
        if (bot.config.name == path[1]) {
          bot.inbox.emit('webhook', req.url, data);
        }
      }
    });
    res.end();
  })
  .listen(1984);

export const db = new Database();
db.events.once('loaded', async () => {
  start();
  db.events.on('update:configs', async () => {
    start();
  });
});
db.init();
