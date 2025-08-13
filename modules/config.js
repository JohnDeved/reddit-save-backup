"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const zod_1 = __importDefault(require("zod"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const ConfigSchema = zod_1.default.object({
    CLIENT_ID: zod_1.default.string().nonempty(),
    CLIENT_SECRET: zod_1.default.string().nonempty(),
    REDDIT_USERNAME: zod_1.default.string().nonempty(),
    REDDIT_PASSWORD: zod_1.default.string().nonempty(),
    DISCORD_TOKEN: zod_1.default.string().nonempty(),
});
exports.config = ConfigSchema.parse(process.env);
