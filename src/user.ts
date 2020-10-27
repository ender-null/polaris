export class User {
  id: number | string;
  firstName: string;
  lastName: string;
  username: string;
  isBot: boolean;

  constructor(id: number | string, firstName?: string, lastName?: string, username?: string, isBot = false) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.username = username;
    this.isBot = isBot;
  }
}
