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
const old_saved_json_1 = __importDefault(require("../old.saved.json"));
const saved_1 = __importDefault(require("@undefined/saved"));
const fs_1 = __importDefault(require("fs"));
// fetch info for old saves in batches of 100
main();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const batches = [];
        for (let i = 0; i < old_saved_json_1.default.length; i += 100) {
            batches.push(old_saved_json_1.default.slice(i, i + 100));
        }
        const results = [];
        let fetchCount = 0;
        // eslint-disable-next-line no-unreachable-loop
        for (const batch of batches) {
            // must be 100 requests per minute max
            yield new Promise(resolve => setTimeout(resolve, 60 * 1000 / 100));
            fetchCount += batch.length;
            console.log(`fetching ${fetchCount} of ${old_saved_json_1.default.length}`);
            const res = yield fetch(`https://www.reddit.com/api/info.json?id=${batch.join(',')}`)
                .then(res => res.json())
                .then(res => res.data.children);
            results.push(...res);
        }
        // filter out already saved by title
        const storedTitles = saved_1.default.map(s => s.title);
        const unStored = results.filter(r => !storedTitles.includes(r.data.title));
        const unStoredNames = unStored.map(u => u.data.name);
        const alreadyStored = results.filter(r => storedTitles.includes(r.data.title));
        console.log(`found ${unStored.length} new saves`);
        console.log(`found ${alreadyStored.length} already saved`);
        console.log(`found ${results.length} total saves`);
        // write to file
        fs_1.default.writeFileSync('./old.saved.json', JSON.stringify(unStoredNames, null, 2));
        // update alreadyStored with new ids and names
        for (const store of alreadyStored) {
            const index = saved_1.default.findIndex(s => s.title === store.data.title);
            saved_1.default[index].id = store.data.id;
            saved_1.default[index].name = store.data.name;
        }
        fs_1.default.writeFileSync('./stored.json', JSON.stringify(saved_1.default, null, 2));
    });
}
