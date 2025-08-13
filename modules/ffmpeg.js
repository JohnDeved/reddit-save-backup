"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const ffprobe_static_1 = __importDefault(require("ffprobe-static"));
if (ffmpeg_static_1.default)
    fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
if (ffprobe_static_1.default.path)
    fluent_ffmpeg_1.default.setFfprobePath(ffprobe_static_1.default.path);
exports.default = fluent_ffmpeg_1.default;
