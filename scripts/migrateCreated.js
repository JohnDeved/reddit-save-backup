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
const fs_1 = require("fs");
const zod_1 = __importDefault(require("zod"));
const reddit_1 = require("../modules/reddit");
const config_1 = require("../modules/config");
const stored = zod_1.default.array(zod_1.default.object({
    id: zod_1.default.string(),
    title: zod_1.default.string(),
    name: zod_1.default.string(),
    orgUrl: zod_1.default.string().url().or(zod_1.default.array(zod_1.default.string().url())),
    cdnUrl: zod_1.default.string().url().or(zod_1.default.array(zod_1.default.string().url())),
    msgId: zod_1.default.string().or(zod_1.default.array(zod_1.default.string())),
    msgUrl: zod_1.default.string().or(zod_1.default.array(zod_1.default.string())),
    created: zod_1.default.number().optional(),
})).parse(JSON.parse((0, fs_1.readFileSync)('./stored.json', 'utf8')));
const reddit = new reddit_1.Reddit(config_1.config.CLIENT_ID, config_1.config.CLIENT_SECRET, config_1.config.REDDIT_USERNAME, config_1.config.REDDIT_PASSWORD);
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
addCreated();
function addCreated() {
    return __awaiter(this, void 0, void 0, function* () {
        // for every batch of 100
        for (let i = 0; i < stored.length; i += 100) {
            const batch = stored.slice(i, i + 100);
            console.log('batch', i, batch.length);
            yield sleep(1000); // rate limit
            const infos = yield reddit.getPostInfos(batch.map(({ name }) => name));
            for (const { data } of infos.children) {
                const { created, id } = data;
                const index = stored.findIndex((item) => item.id === id);
                if (index === -1) {
                    console.log('missing', id);
                    continue;
                }
                stored[index].created = created;
            }
        }
        (0, fs_1.writeFileSync)('./stored.json', JSON.stringify(stored, null, 2));
    });
}
