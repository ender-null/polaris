import { BindingsBase } from "../bindings";
import { Bot } from "../bot";

export class TelegramTDlibBindings extends BindingsBase {
    constructor(bot: Bot) {
        super(bot);
    }
}