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
const p_limit_1 = __importDefault(require("p-limit"));
const mediaResolution_1 = require("../modules/mediaResolution");
const stored = zod_1.default.array(zod_1.default.object({
    id: zod_1.default.string(),
    title: zod_1.default.string(),
    name: zod_1.default.string(),
    orgUrl: zod_1.default.string().url().or(zod_1.default.array(zod_1.default.string().url())),
    cdnUrl: zod_1.default.string().url().or(zod_1.default.array(zod_1.default.string().url())),
    msgId: zod_1.default.string().or(zod_1.default.array(zod_1.default.string())),
    msgUrl: zod_1.default.string().or(zod_1.default.array(zod_1.default.string())),
    created: zod_1.default.number(),
    height: zod_1.default.number().optional(),
    width: zod_1.default.number().optional(),
})).parse(JSON.parse((0, fs_1.readFileSync)('./stored.json', 'utf8')));
migrateResolution();
function migrateResolution() {
    return __awaiter(this, void 0, void 0, function* () {
        const limit = (0, p_limit_1.default)(10);
        const promises = stored.map((item, i) => limit(() => __awaiter(this, void 0, void 0, function* () {
            try {
                // skip if already has resolution
                if (item.height && item.width)
                    return;
                const media = Array.isArray(item.cdnUrl) ? item.cdnUrl[0] : item.cdnUrl;
                const res = yield (0, mediaResolution_1.getMediaResolution)(media);
                const perc = Math.round((i / stored.length) * 1000) / 10;
                console.log(item.cdnUrl, res, i, limit.pendingCount, `${perc}%`);
                stored[i].height = res.height;
                stored[i].width = res.width;
                (0, fs_1.writeFileSync)('./stored.json', JSON.stringify(stored, null, 2));
            }
            catch (e) {
                console.error(e);
            }
        })));
        yield Promise.all(promises);
        console.log('done');
    });
}
