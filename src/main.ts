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
  bot.stop();
  process.exit(1);
};

const config = Config.loadFromFile('config.json');
const bot = new Bot(config);
bot.start();

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
