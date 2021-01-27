import { readFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { createServer } from 'https';
import { Bot, Config, Database } from '.';
import { catchException, logger } from './utils';

// global.Promise = require('bluebird');
process.setMaxListeners(0);

const bots: Bot[] = [];

export async function stop(exit?: boolean): Promise<void> {
  let pending = bots.length;
  logger.info(`🟡 Stopping ${pending} bot(s)...`);
  for (const bot of bots) {
    try {
      await bot.stop();
    } catch (e) {
      logger.error(e.message);
    }

    pending -= 1;
    if (pending == 0) {
      if (exit) {
        logger.info('✅ Closed all bot(s), exiting process');
        process.exit();
      } else {
        logger.info('✅ Closed all bot(s)');
        process.exit();
      }
    } else {
      logger.info(`⏳ Pending ${pending} bot(s)...`);
    }
  }
}

export async function start(): Promise<void> {
  if (Array.isArray(bots) && bots.length > 0) {
    stop();
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

  let started = 0;
  for (const config of configs) {
    if (config.enabled) {
      const bot = new Bot(config);
      process.on('unhandledRejection', (exception: Error) => {
        catchException(exception, bot);
      });
      await bot.start();
      started += 1;
      bots.push(bot);
    } else {
      logger.info(`🔴 Bot is disabled: ${config.icon} ${config.name} [${config.bindings}]`);
    }
  }
  logger.info(`✅ Started ${started}/${configs.length} bot(s)`);
}

process.once('SIGINT', () => stop(true));
process.once('SIGTERM', () => stop(true));

const options = {
  key: readFileSync('data/key.pem'),
  cert: readFileSync('data/cert.pem'),
};

createServer(options, (req: IncomingMessage, res: ServerResponse) => {
  const path = req.url.split('/');
  let found = false;
  req.on('data', (data: string) => {
    const prettyData = JSON.stringify(JSON.parse(data), null, 4);

    for (const bot of bots) {
      if (bot.config.name == path[1]) {
        found = true;
        bot.inbox.emit('webhook', req.url, prettyData);
      }
    }
    res.writeHead(found ? 200 : 404);
    res.end(found ? 'OK' : 'Not Found');
  });
}).listen(1984);

export const db = new Database();
db.events.once('loaded', async () => {
  start();
  db.events.on('update:configs', async () => {
    start();
  });
});
db.init();
