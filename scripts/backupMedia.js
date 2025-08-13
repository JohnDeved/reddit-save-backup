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
const promises_1 = require("stream/promises");
const saved_1 = __importDefault(require("@undefined/saved"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const backupPath = path_1.default.resolve(__dirname, '../media');
main();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const urls = saved_1.default.map(s => s.cdnUrl).flat();
        let downloaded = 0;
        for (const url of urls) {
            downloaded++;
            let fileName = url.split('/').pop();
            if (!fileName)
                continue;
            if (fileName.includes('?')) {
                const fileNameStrp = fileName.split('?').shift();
                if ((0, fs_1.existsSync)(`${backupPath}/${fileName}`)) {
                    console.log('renaming', fileName, fileNameStrp);
                    (0, fs_1.renameSync)(`${backupPath}/${fileName}`, `${backupPath}/${fileNameStrp}`);
                }
                fileName = fileNameStrp;
            }
            const filePath = `${backupPath}/${fileName}`;
            if ((0, fs_1.existsSync)(filePath))
                continue;
            const res = yield fetch(url);
            console.log(`downloading ${downloaded}/${urls.length} ${fileName}`, 'at url', url);
            yield (0, promises_1.pipeline)(res.body, (0, fs_1.createWriteStream)(filePath));
        }
    });
}
