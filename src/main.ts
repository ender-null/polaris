import { Config,Bot } from './index';
import { createLogger, format, transports } from 'winston';

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

const config = Config.loadFromFile('config.json');
const bot = new Bot(config);
bot.start();