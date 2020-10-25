export class Conversation {
  id: number | string;
  title: string;

  constructor(id: number | string, title?: string) {
    this.id = id;
    this.title = title;
  }
}
