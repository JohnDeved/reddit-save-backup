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
const undici_1 = require("undici");
const old_saved_json_1 = __importDefault(require("../old.saved.json"));
const p_limit_1 = __importDefault(require("p-limit"));
const bytes_1 = __importDefault(require("bytes"));
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = __importDefault(require("path"));
const saved_1 = __importDefault(require("@undefined/saved"));
function fetchRetry(url, options) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            return yield (0, undici_1.fetch)(url, options);
        }
        catch (err) {
            if (err instanceof Error)
                console.error(err.message);
            return fetchRetry(url, options);
        }
    });
}
check();
function check() {
    return __awaiter(this, void 0, void 0, function* () {
        const entries = saved_1.default.flatMap(entry => {
            if (!Array.isArray(entry.cdnUrl)) {
                return {
                    url: entry.cdnUrl,
                    name: entry.name,
                };
            }
            return entry.cdnUrl.map(url => ({
                url,
                name: entry.name,
            }));
        });
        const limit = (0, p_limit_1.default)(50);
        const promises = entries.map((entry, i) => limit(() => __awaiter(this, void 0, void 0, function* () {
            const { ok, status, headers } = yield fetchRetry(entry.url, { method: 'HEAD' });
            const contentLength = headers.get('content-length');
            const perc = Math.round((i / entries.length) * 1000) / 10;
            console.log(entry.url, status, i, limit.pendingCount, `${perc}%`);
            return Object.assign({ ok,
                status,
                contentLength }, entry);
        })));
        const results = yield Promise.all(promises);
        const failed = results.filter(({ ok }) => !ok);
        console.log('not ok', failed);
        const total = results.reduce((acc, { contentLength }) => acc + Number(contentLength), 0);
        console.log('total size', (0, bytes_1.default)(total));
        const failedIds = failed.map(({ name }) => name);
        const newStored = saved_1.default.filter(({ name }) => !failedIds.includes(name));
        console.log('newStored', newStored.length, 'oldStored', saved_1.default.length);
        // remove failed from stored.json
        (0, fs_1.writeFileSync)('./stored.json', JSON.stringify(newStored, null, 2));
        // add to the beginning of old.saved.json
        const newOldSaved = [...failedIds, ...old_saved_json_1.default];
        (0, fs_1.writeFileSync)('./old.saved.json', JSON.stringify(newOldSaved, null, 2));
        // check backup size
        const backupPath = path_1.default.resolve(__dirname, '../media');
        // if backup path exists
        if ((0, fs_1.existsSync)(backupPath)) {
            for (const { contentLength, ok, url } of results) {
                if (!ok)
                    continue;
                const fileName = url.split('/').pop();
                if (!fileName)
                    continue;
                const filePath = `${backupPath}/${fileName}`;
                const fileSize = Number(contentLength);
                if (!(0, fs_1.existsSync)(filePath))
                    continue;
                const stats = yield (0, promises_1.stat)(filePath);
                const backupFileSize = stats.size;
                if (fileSize !== backupFileSize) {
                    console.log(`file size mismatch ${fileSize} !== ${backupFileSize}`, 'at', filePath, 'removing file');
                    yield (0, promises_1.rm)(filePath);
                }
            }
        }
    });
}
