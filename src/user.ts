export class User {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  isBot: boolean;

  constructor(
    id: number,
    firstName: string = null,
    lastName: string = null,
    username: string = null,
    isBot: boolean = false,
  ) {
    this.id = id;
    this.firstName = firstName;
    this.lastName = lastName;
    this.username = username;
    this.isBot = isBot;
  }
}
