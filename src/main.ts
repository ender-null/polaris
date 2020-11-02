import { Bot, Config, Database } from '.';
import { catchException, logger } from './utils';

let bots: Bot[] = [];

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

export const db = new Database();
bots = [];
db.events.on('update:configs', () => {
  for (const key of Object.keys(db.configs)) {
    const configs = Config.loadInstancesFromJSON(db.configs[key]);
    for (const config of configs) {
      let found = false;
      for (const bot of bots) {
        if (bot.config.name == config.name && bot.config.bindings == config.bindings) {
          bot.config = config;
          if (!config.enabled) {
            bot.stop();
          }
          found = true;
          break;
        }
      }
      if (!found) {
        const bot = new Bot(config);
        if (config.enabled) {
          process.on('unhandledRejection', (exception: Error) => {
            catchException(exception, bot);
          });
          bot.start();
        }
        bots.push(bot);
      }
    }
  }
});
db.init();
