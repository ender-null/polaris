import { escapeMarkdown } from './utils';

const text = 'hola mundo! espero que (todo el mundo) este [guay] *JAJA*';
console.log(escapeMarkdown(text));
process.exit();
