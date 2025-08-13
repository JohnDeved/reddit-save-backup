"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = __importDefault(require("discord.js"));
const config_1 = require("../modules/config");
const saved_1 = __importDefault(require("@undefined/saved"));
const p_limit_1 = __importDefault(require("p-limit"));
const discord = new discord_js_1.default.Client({
    intents: ['GuildMessages'],
});
function getAllMessages(channel) {
    return new Promise((resolve, reject) => {
        let messages = new discord_js_1.default.Collection();
        const fetch = (before) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const fetched = yield channel.messages.fetch({ limit: 100, before });
            messages = messages.concat(fetched);
            console.log(`collected ${messages.size} messages`);
            if (fetched.size < 100) {
                resolve(messages);
            }
            else {
                fetch((_a = fetched.last()) === null || _a === void 0 ? void 0 : _a.id);
            }
        });
        fetch();
    });
}
discord.login(config_1.config.DISCORD_TOKEN).then(() => __awaiter(void 0, void 0, void 0, function* () {
    const channel = yield discord.channels.fetch('1118929807057616937');
    if (!(channel === null || channel === void 0 ? void 0 : channel.isTextBased))
        throw new Error('channel is not text based');
    if (!(channel instanceof discord_js_1.default.TextChannel))
        throw new Error('channel is not text channel');
    // get all messages in channel
    const messages = yield getAllMessages(channel);
    console.log(`got ${messages.size} messages`);
    // get all stored msgIds
    const storedIds = saved_1.default.map(s => s.msgId).flat();
    // get all messages that are not in stored
    const toDelete = messages.filter(m => !storedIds.includes(m.id));
    console.log(`found ${toDelete.size} messages to delete`);
    const limit = (0, p_limit_1.default)(5);
    // delete all messages
    yield Promise.all(toDelete.map(m => limit(() => __awaiter(void 0, void 0, void 0, function* () {
        yield m.delete();
        console.log(`deleted message ${m.id}`);
    }))));
    discord.destroy();
}));
