import { Bot } from "./bot";

export class BindingsBase {
    bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    send_message() {

    }
}