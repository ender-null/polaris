import { EventEmitter } from 'events';
import firebase from 'firebase';
import 'firebase/database';
import { readFileSync } from 'fs';
import { iConfig, iConversation, iPin, iPole, iReminder, iTag, iTranslation, iUser } from '.';

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
  translationsSnap: firebase.database.DataSnapshot;
  translations: iTranslation;
  constructor() {
    this.events = new EventEmitter();
  }

  init(): void {
    const firebaseConfig = JSON.parse(readFileSync('firebase.json', 'utf-8'));
    firebase.initializeApp(firebaseConfig);
    this.fb = firebase.database();
    const tables = ['configs', 'users', 'groups', 'pins', 'poles', 'reminders', 'tags', 'translations'];
    for (const table of tables) {
      this.fb.ref(`db/${table}`).on('value', (snapshot: firebase.database.DataSnapshot) => {
        this[table + 'Snap'] = snapshot;
        this[table] = snapshot.toJSON();
        this.events.emit(`update:${table}`);
      });
    }
  }
}
