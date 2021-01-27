import { readFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { createServer } from 'https';
import { Bot, Config, Database } from '.';
import { catchException, getBindingsSlug, logger } from './utils';

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

createServer(options, async (req: IncomingMessage, res: ServerResponse) => {
  const path = req.url.split('/');
  let found = false;
  let content;

  if (req.method === 'GET') {
    content = null;
  } else if (req.method === 'POST') {
    content = await new Promise((resolve) => {
      const chunks = [];
      req.on('data', (chunk) => {
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(JSON.stringify(JSON.parse(Buffer.concat(chunks).toString()), null, 4));
      });
    });
  }

  for (const bot of bots) {
    let name = path[1];
    let bindings = null;
    if (name.indexOf(':') > -1) {
      name = path[1].split(':')[0];
      bindings = path[1].split(':')[1];
    }
    const slug = getBindingsSlug(bot.bindings);
    if (bot.config.name == name) {
      found = true;
      if (bindings) {
        if (bindings == slug) {
          await bot.webhookHandler(req, res, content);
        }
      } else {
        await bot.webhookHandler(req, res, content);
      }
    }
  }

  if (!res.writableEnded) {
    res.statusCode = found ? 200 : 404;
    res.writeHead(found ? 200 : 404);
    res.end(found ? 200 : 404);
  }
}).listen(1984);

export const db = new Database();
db.events.once('loaded', async () => {
  start();
  db.events.on('update:configs', async () => {
    start();
  });
});
db.init();
