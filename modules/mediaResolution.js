"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMediaResolution = void 0;
/* eslint-disable @typescript-eslint/no-confusing-void-expression */
const ffmpeg_1 = __importDefault(require("../modules/ffmpeg"));
function getMediaResolution(filePath) {
    const ffmpeg = (0, ffmpeg_1.default)();
    return new Promise((resolve, reject) => ffmpeg.input(filePath).ffprobe((err, data) => {
        ffmpeg.kill('SIGKILL');
        if (err)
            return reject(err);
        // get first stream with resolution
        const stream = data.streams.find(s => s.width && s.height);
        if (!stream)
            return reject(new Error(`getMediaResolution: no streams ${filePath}`));
        if (!stream.width || !stream.height)
            return reject(new Error(`getMediaResolution: no resolution ${filePath}`));
        resolve({
            width: stream.width,
            height: stream.height,
        });
    }));
}
exports.getMediaResolution = getMediaResolution;
