/// <reference lib="dom" />
import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/database';
import { Bot, Config } from '.';

const bots = [];

export const stop = (): void => {
  for (const bot of bots) {
    bot.stop();
  }
  process.exit(1);
};

// TODO: Replace the following with your app's Firebase project configuration
const firebaseConfig = {
  apiKey: 'AIzaSyDj_0pcAmf_NiTzZT7B0QEY1tPfrnlnqSY',
  authDomain: 'polaris-bot.firebaseapp.com',
  databaseURL: 'https://polaris-bot.firebaseio.com',
  projectId: 'polaris-bot',
  storageBucket: 'polaris-bot.appspot.com',
  messagingSenderId: '617329433754',
  appId: '1:617329433754:web:afd6a7ded8b87d19955323',
};

// Initialize Firebase
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
