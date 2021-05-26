import { readFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import { createServer } from 'https';
import { Bot, Config, Database } from '.';
import { catchException, getBindingsSlug, logger } from './utils';

process.setMaxListeners(0);

const bots: Bot[] = [];

export const stop = async (exit?: boolean): Promise<void> => {
  logger.info(`🟡 Stopping ${bots.length} bot(s)...`);
  bots.map(async (bot, i) => {
    try {
      await bot.stop();
      bots.splice(i, 1);
    } catch (e) {
      logger.error(e.message);
    }

    if (bots.length == 0) {
      logger.info('✅ Closed all bot(s)');
      if (exit) {
        process.exit();
      }
    } else {
      logger.info(`⏳ Pending ${bots.length} bot(s)...`);
    }
  });
};

export const start = async (): Promise<void> => {
  if (Array.isArray(bots) && bots.length > 0) {
    await stop();
  }
  const config = Config.loadFromFile('config.json');
  const configs = [];
  if (config) {
    configs.push(config);
  } else {
    Object.keys(db.configs).map((name) => {
      configs.push(...Config.loadInstancesFromJSON(db.configs[name]));
    });
  }

  await Promise.all(
    configs.map(async (config) => {
      if (config.enabled) {
        const bot = new Bot(config);
        process.on('unhandledRejection', (exception: Error) => {
          catchException(exception, bot);
        });
        await bot.start();
        bots.push(bot);
      } else {
        logger.info(`🔴 Bot is disabled: ${config.icon} ${config.name} [${config.bindings}]`);
      }
    }),
  );
  logger.info(`✅ Started ${bots.length}/${configs.length} bot(s)`);
};

process.on('SIGINT', () => stop(true));
process.on('SIGTERM', () => stop(true));
process.on('exit', () => {
  logger.info('❎ Exit process');
});

if (process.env.ENV != 'dev') {
  const options = {
    key: readFileSync('data/key.pem'),
    cert: readFileSync('data/cert.pem'),
  };

  createServer(options, async (req: IncomingMessage, res: ServerResponse) => {
    const path = req.url.split('/');
    let found = false;
    let content: string;

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

    await Promise.all(
      bots.map(async (bot) => {
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
      }),
    );

    if (!res.writableEnded) {
      res.statusCode = found ? 200 : 404;
      res.writeHead(found ? 200 : 404);
      res.end(found ? 'OK' : 'Not Found');
    }
  }).listen(1984);
}

export const db = new Database();
db.events.once('loaded', async () => {
  await start();
  db.events.on('update:configs', async () => {
    await start();
  });
});
db.init();
