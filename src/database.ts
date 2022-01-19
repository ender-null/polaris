import { EventEmitter } from 'events';
import { readFileSync } from 'fs';
import { initializeApp } from 'firebase/app';
import { Database as DB, DataSnapshot, getDatabase, onValue, ref } from 'firebase/database';
import { iConfig, iConversation, iPin, iPole, iReminder, iTag, iTranslation, iUser } from '.';
import { iGroupAdministration } from './types';
import { logger } from './utils';

export class Database {
  fb: DB;
  events: EventEmitter;
  configsSnap: DataSnapshot;
  configs: iConfig;
  usersSnap: DataSnapshot;
  users: iUser;
  groupsSnap: DataSnapshot;
  groups: iConversation;
  pinsSnap: DataSnapshot;
  pins: iPin;
  polesSnap: DataSnapshot;
  poles: iPole;
  remindersSnap: DataSnapshot;
  reminders: iReminder;
  tagsSnap: DataSnapshot;
  tags: iTag;
  administrationSnap: DataSnapshot;
  administration: iGroupAdministration;
  translationsSnap: DataSnapshot;
  translations: iTranslation;
  constructor() {
    this.events = new EventEmitter();
  }

  init(): void {
    const firebaseConfig = JSON.parse(readFileSync('firebase.json', 'utf-8'));
    initializeApp(firebaseConfig);
    this.fb = getDatabase();
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
    tables.map((table) => {
      onValue(ref(this.fb, `db/${table}`), (snapshot: DataSnapshot) => {
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
            logger.info('✅ Loaded database');
            this.events.emit('loaded');
            loaded = true;
          }
        }
      });
    });
  }
}
