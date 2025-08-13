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
exports.compressMedia = void 0;
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const ffprobe_static_1 = __importDefault(require("ffprobe-static"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
if (ffmpeg_static_1.default)
    fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
if (ffprobe_static_1.default.path)
    fluent_ffmpeg_1.default.setFfprobePath(ffprobe_static_1.default.path);
function logDiff(oPath, cPath, bitrate) {
    return __awaiter(this, void 0, void 0, function* () {
        const { size: oSize } = yield (0, promises_1.stat)(oPath);
        const { size: cSize } = yield (0, promises_1.stat)(cPath);
        const sizeDiff = Math.round((oSize - cSize) / oSize * 100);
        if (bitrate)
            console.log(`bitrate: ${bitrate}kb`);
        console.log(`compressed new video size: ${cSize} bytes`);
        console.log(`compressed old video size: ${oSize} bytes`);
        console.log(`compressed video size: ${sizeDiff}% smaller than original`);
    });
}
function compressMedia(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const ffmpeg = (0, fluent_ffmpeg_1.default)()
            .on('stdout', console.log)
            .on('stderr', console.log);
        // Prevent infinite compression cycles
        if (filePath.includes('_cl.mp4')) {
            throw new Error(`File already compressed to lossy format: ${filePath}`);
        }
        // check if file already exists in compressed format
        if (filePath.endsWith('.mp4') && (0, fs_1.existsSync)(filePath.replace(/\.mp4/, '_cl.mp4'))) {
            console.log('compressed file already exists');
            return filePath.replace(/\.mp4/, '_cl.mp4');
        }
        if (filePath.endsWith('_c.mp4')) {
            // adjust bitrate according to video duration to reach 10mb file size. also min scale 720p
            const duration = yield new Promise((resolve, reject) => {
                ffmpeg.input(filePath)
                    .ffprobe((err, data) => {
                    if (err)
                        reject(err);
                    else
                        resolve(data.format.duration);
                });
            });
            if (!duration)
                throw new Error('cannot get video duration');
            // bitrate in kb
            // Target 10MB file size for Discord
            const bitrate = Math.floor(10 * 1024 * 8 / duration);
            const outPath = filePath.replace(/_c\.mp4/, '_cl.mp4'); // cl = compressed lossy
            return new Promise((resolve, reject) => {
                ffmpeg.input(filePath)
                    .on('end', () => __awaiter(this, void 0, void 0, function* () {
                    yield logDiff(filePath, outPath, bitrate);
                    resolve(outPath);
                    ffmpeg.kill('SIGKILL');
                }))
                    .on('error', reject)
                    .outputFormat('mp4')
                    // max bitrate
                    .addOption('-maxrate', `${bitrate}k`)
                    .addOption('-bufsize', `${bitrate * 2}k`)
                    // min scale 720p
                    .addOption('-vf', "scale='if(gt(iw,ih),1280,-2):if(gt(iw,ih),-2,1280)")
                    .save(outPath);
            });
        }
        if (filePath.endsWith('.gif') || filePath.endsWith('.mp4')) {
            // gif to mp4
            return new Promise((resolve, reject) => {
                const outPath = filePath.replace(/\.gif|\.mp4/, '_c.mp4'); // c = compressed
                ffmpeg.input(filePath)
                    .on('end', () => __awaiter(this, void 0, void 0, function* () {
                    yield logDiff(filePath, outPath);
                    resolve(outPath);
                    ffmpeg.kill('SIGKILL');
                }))
                    .on('error', reject)
                    .outputFormat('mp4')
                    .save(outPath);
            });
        }
        // check if is image
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.png')) {
            // image downscale to 1080p
            return new Promise((resolve, reject) => {
                const outPath = filePath.replace(/\.(jpg|jpeg|png)/, '_c.jpg'); // c = compressed
                ffmpeg.input(filePath)
                    .on('end', () => __awaiter(this, void 0, void 0, function* () {
                    yield logDiff(filePath, outPath);
                    resolve(outPath);
                    ffmpeg.kill('SIGKILL');
                }))
                    .on('error', reject)
                    .outputFormat('mjpeg')
                    // min scale 1080p
                    .addOption('-vf', "scale='if(gt(iw,ih),1920,-1):if(gt(iw,ih),-1,1920)")
                    .addOption('-q', '1')
                    .save(outPath);
            });
        }
        throw new Error(`unknown file type, cannot convert ${filePath}`);
    });
}
exports.compressMedia = compressMedia;
