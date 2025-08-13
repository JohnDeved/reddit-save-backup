"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const saved_1 = __importDefault(require("@undefined/saved"));
// find dubplicates
const duplicates = saved_1.default.filter((item, index, self) => self.findIndex(i => i.name === item.name) !== index);
console.log('found', duplicates.length, 'duplicates');
// remove duplicates
const filtered = saved_1.default.filter(item => !duplicates.includes(item));
(0, fs_1.writeFileSync)('./stored.json', JSON.stringify(filtered, null, 2));
// find items with emtpy cdnUrl
const emptyCdnUrl = saved_1.default.filter(item => item.cdnUrl.length === 0);
console.log('found', emptyCdnUrl.length, 'items with empty cdnUrl');
// remove items with empty cdnUrl
const filtered2 = filtered.filter(item => !emptyCdnUrl.includes(item));
(0, fs_1.writeFileSync)('./stored.json', JSON.stringify(filtered2, null, 2));
