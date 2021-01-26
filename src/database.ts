import { EventEmitter } from 'events';
import firebase from 'firebase';
import 'firebase/database';
import { readFileSync } from 'fs';
import { iConfig, iConversation, iPin, iPole, iReminder, iTag, iTranslation, iUser } from '.';
import { iGroupAdministration } from './types';
import { logger } from './utils';

export class Database {
  fb: firebase.database.Database;
  events: EventEmitter;
  configsSnap: firebase.database.DataSnapshot;
  configs: iConfig;
  usersSnap: firebase.database.DataSnapshot;
  users: iUser;
  groupsSnap: firebase.database.DataSnapshot;
  groups: iConversation;
  pinsSnap: firebase.database.DataSnapshot;
  pins: iPin;
  polesSnap: firebase.database.DataSnapshot;
  poles: iPole;
  remindersSnap: firebase.database.DataSnapshot;
  reminders: iReminder;
  tagsSnap: firebase.database.DataSnapshot;
  tags: iTag;
  administrationSnap: firebase.database.DataSnapshot;
  administration: iGroupAdministration;
  translationsSnap: firebase.database.DataSnapshot;
  translations: iTranslation;
  constructor() {
    this.events = new EventEmitter();
  }

  init(): void {
    const firebaseConfig = JSON.parse(readFileSync('firebase.json', 'utf-8'));
    firebase.initializeApp(firebaseConfig);
    this.fb = firebase.database();
    const tables = [
      'configs',
      'users',
      'groups',
      'pins',
      'poles',
      'reminders',
      'tags',
      'administration',
      'translations',
    ];
    const ready = [];
    let loaded = false;
    for (const table of tables) {
      this.fb.ref(`db/${table}`).on('value', (snapshot: firebase.database.DataSnapshot) => {
        this[table + 'Snap'] = snapshot;
        if (!this[table] || table == 'configs' || table == 'translations') {
          this[table] = snapshot.toJSON();
          logger.info(`🗂️ Loaded ${table} [${this[table] ? Object.keys(this[table]).length : 0}]`);
        }
        this.events.emit(`update:${table}`);
        if (!loaded) {
          if (ready.indexOf(table) == -1) {
            ready.push(table);
          }
          if (ready.length == tables.length) {
            logger.info('✅ Initial load complete');
            this.events.emit('loaded');
            loaded = true;
          }
        }
      });
    }
  }
}
