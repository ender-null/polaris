export class Conversation {
  id: number;
  title: string;

  constructor(id: number, title: string = null) {
    this.id = id;
    this.title = title;
  }
}
