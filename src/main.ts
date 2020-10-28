import { Bot, Config, Database } from '.';
import { logger } from './utils';

const bots: Bot[] = [];

export async function stop(): Promise<void> {
  let pending = bots.length;
  for (const bot of bots) {
    this.status.on('stopped', async () => {
      pending -= 1;
      if (pending == 0) {
        process.exit(1);
      } else {
        logger.info(`Pending ${pending} bots...`);
      }
    });
    await bot.stop();
  }
}

export const db = new Database();
db.events.once('update:configs', () => {
  const bots = [];
  for (const key of Object.keys(db.configs)) {
    const configs = Config.loadInstancesFromJSON(db.configs[key]);
    for (const config of configs) {
      const bot = new Bot(config);
      bot.start();
      bots.push(bot);
    }
  }
});
db.init();

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
