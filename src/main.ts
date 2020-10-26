/// <reference lib="dom" />
import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import { readFileSync } from 'fs';
import { Bot, Config } from '.';

const bots = [];

export const stop = (): void => {
  for (const bot of bots) {
    bot.stop();
  }
  process.exit(1);
};

const firebaseConfig = JSON.parse(readFileSync('firebase.json', 'utf-8'));
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
db.ref('configs')
  .once('value')
  .then((snapshot) => {
    snapshot.forEach((child: any) => {
      const configs = Config.loadInstancesFromJSON(child.val());
      const bots = [];
      for (const config of configs) {
        const bot = new Bot(config);
        bot.start();
        bots.push(bot);
      }
    });
  });

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
