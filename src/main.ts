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
db.events.once('update:configs', () => {
  bots = [];
  for (const key of Object.keys(db.configs)) {
    const configs = Config.loadInstancesFromJSON(db.configs[key]);
    for (const config of configs) {
      const bot = new Bot(config);
      process.on('unhandledRejection', (exception: Error) => {
        catchException(exception, bot);
      });
      if (config.enabled) {
        bot.start();
      }
      bots.push(bot);
    }
  }
});
db.init();
