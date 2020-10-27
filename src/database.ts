import { EventEmitter } from 'events';
import firebase from 'firebase';
import 'firebase/database';
import { readFileSync } from 'fs';

export class Database {
  fb: firebase.database.Database;
  events: EventEmitter;
  configs?;
  users?;
  groups?;
  pins?;
  poles?;
  reminders?;
  tags?;
  translations?;
  constructor() {
    this.events = new EventEmitter();
  }

  init(): void {
    const firebaseConfig = JSON.parse(readFileSync('firebase.json', 'utf-8'));
    firebase.initializeApp(firebaseConfig);
    this.fb = firebase.database();
    const tables = ['configs', 'users', 'groups', 'tags'];
    for (const table of tables) {
      this.fb.ref(`db/${table}`).on('value', (snapshot: firebase.database.DataSnapshot) => {
        this[table] = snapshot;
        this.events.emit(`update:${table}`);
      });
    }
  }
}
