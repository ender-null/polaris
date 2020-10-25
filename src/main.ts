import { createLogger, format, transports } from 'winston';
import { Bot, Config } from './index';

// Configure logger
export const logger = createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.Console({
      format: format.combine(format.simple(), format.colorize()),
    }),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
  ],
});

export const stop = (): void => {
  for (const bot of bots) {
    bot.stop();
  }
  process.exit(1);
};

const configs = Config.loadInstancesFromFile('config.json');
const bots = [];
for (const config of configs) {
  const bot = new Bot(config);
  bot.start();
  bots.push(bot);
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
