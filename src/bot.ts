import { Config, BindingsBase, Message, Plugin, User } from './index';
import * as bindings from './bindings/index';
import {logger} from './main';

export class Bot {
    config: Config;
    bindings: BindingsBase;
    inbox: Message[];
    outbox: Message[];
    started: boolean;
    plugins: Plugin[];
    user: User;

    constructor(config: Config) {
        this.config = config;
        this.bindings = new bindings[this.config.bindings](this);
    }

    start() {
        this.user = this.bindings.getMe();
        logger.info(this.user);
    }

    stop() {
    }

    messagesHandler() {
    }

    initPlugins() {
    }

    onMessageReceive(msg: Message) {
        logger.info(msg.content)
    }

    checkTrigger(command: string, parameters: string[], message: string, plugin: Plugin, friendly:boolean=false, keep_default:boolean=false) {

    }

    replyMessage(msg: Message, content: string, type: string='text', reply: Message=null, extra:any=null) {
        const message = new Message(null, msg.conversation, this.user, content, type, reply=reply, extra=extra);
        this.outbox.push(message);
    }
}