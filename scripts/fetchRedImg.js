"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const promises_1 = require("stream/promises");
const undici_1 = require("undici");
(0, undici_1.fetch)('https://api.redgifs.com/v2/gifs/joyfulbarrenhypacrosaurus/files/JoyfulBarrenHypacrosaurus-large.jpg')
    .then(res => res.body)
    .then(body => {
    if (!body)
        throw new Error('no body');
    const file = fs_1.default.createWriteStream('./test.jpg');
    setTimeout(() => {
        (0, promises_1.pipeline)(body, file);
    }, 500);
});
