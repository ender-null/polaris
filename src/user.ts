export class User {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  isBot: boolean;

  constructor(id: number, firstName?: string, lastName?: string, username?: string, isBot?: boolean) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.username = username;
    this.isBot = isBot;
  }
}
