"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
exports.stored = void 0;
const Discord = __importStar(require("discord.js"));
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const promises_2 = require("stream/promises");
const stream_1 = require("stream");
const zod_1 = __importDefault(require("zod"));
const config_1 = require("./modules/config");
const downloader_1 = require("./modules/downloader");
const reddit_1 = require("./modules/reddit");
const compress_1 = require("./modules/compress");
const mediaResolution_1 = require("./modules/mediaResolution");
const clips_1 = require("./modules/clips");
// Performance and reliability improvements
const MAX_CONSECUTIVE_FAILURES = 10;
const RATE_LIMIT_DELAY = 1000; // 1 second between requests
const BATCH_SIZE = 20; // Process posts in batches
// Track consecutive failures for early termination
let consecutiveFailures = 0;
let processedCount = 0;
function sanitizeFileName(name) {
    // Remove or replace problematic characters and limit length while preserving extension
    const lastDotIndex = name.lastIndexOf('.');
    const baseName = lastDotIndex > 0 ? name.substring(0, lastDotIndex) : name;
    const extension = lastDotIndex > 0 ? name.substring(lastDotIndex) : '';
    const sanitizedBase = baseName
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 100 - extension.length); // Reserve space for extension
    return sanitizedBase + extension;
}
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise(resolve => setTimeout(resolve, ms));
    });
}
// ffmpeg.input()
const reddit = new reddit_1.Reddit(config_1.config.CLIENT_ID, config_1.config.CLIENT_SECRET, config_1.config.REDDIT_USERNAME, config_1.config.REDDIT_PASSWORD);
const discord = new Discord.Client({
    intents: ['GuildMessages'],
});
const issuePosts = [];
exports.stored = zod_1.default.array(zod_1.default.object({
    id: zod_1.default.string(),
    title: zod_1.default.string(),
    name: zod_1.default.string(),
    orgUrl: zod_1.default.string().url().or(zod_1.default.array(zod_1.default.string().url())),
    cdnUrl: zod_1.default.string().url().or(zod_1.default.array(zod_1.default.string().url())),
    msgId: zod_1.default.string().or(zod_1.default.array(zod_1.default.string())),
    msgUrl: zod_1.default.string().or(zod_1.default.array(zod_1.default.string())),
    created: zod_1.default.number(),
    height: zod_1.default.number(),
    width: zod_1.default.number(),
})).parse(JSON.parse((0, fs_1.readFileSync)('./stored.json', 'utf8')));
let oldSaved = zod_1.default.array(zod_1.default.string()).parse(JSON.parse((0, fs_1.readFileSync)('./old.saved.json', 'utf8')));
function getChannel() {
    return __awaiter(this, void 0, void 0, function* () {
        const channel = yield discord.channels.fetch('1118929807057616937');
        if (!(channel === null || channel === void 0 ? void 0 : channel.isTextBased()))
            throw new Error('channel is not text based');
        return channel;
    });
}
function uploadFile(name, file) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const sanitizedName = sanitizeFileName(name);
        const filePath = `./media/${sanitizedName}`;
        // check if file exists
        let cached = false;
        if (!(0, fs_1.existsSync)(filePath)) {
            if (!file)
                throw new Error('File stream is required for new downloads');
            const writeStream = (0, fs_1.createWriteStream)(filePath);
            // Convert web ReadableStream to Node.js readable stream if needed
            const nodeStream = file.pipe ? file : stream_1.Readable.fromWeb(file);
            yield (0, promises_2.pipeline)(nodeStream, writeStream);
            console.log(`downloaded file ${filePath}`);
        }
        else {
            // kill stream
            console.log(`using cached file ${filePath}`);
            // file.cancel()
            cached = true;
        }
        // get file size
        const { size } = yield (0, promises_1.stat)(filePath);
        // check if file is bigger than 10mb
        if (size > 10 * 1024 * 1024) {
            console.log(`file is bigger than 10mb ${filePath}, trying to compress`);
            const compPath = yield (0, compress_1.compressMedia)(filePath);
            const compName = compPath.split('/').pop();
            if (!compName)
                throw new Error('no compressed name');
            return uploadFile(compName);
        }
        // check if file is smaller than 8kb
        if (size < 8 * 1024) {
            throw new Error(`file is smaller than 8kb ${filePath}, there must be something wrong`);
        }
        console.log(`uploading file ${filePath}, size: ${size}`);
        const channel = yield getChannel();
        const readStream = (0, fs_1.createReadStream)(filePath);
        const message = yield channel.send({ files: [new Discord.AttachmentBuilder(readStream, { name: sanitizedName })] });
        const path = (_a = message.attachments.first()) === null || _a === void 0 ? void 0 : _a.url;
        if (!path)
            throw new Error('attachment not found');
        // await unlink(filePath)
        return {
            filePath,
            path,
            id: message.id,
            url: message.url,
        };
    });
}
function getRedditPosts() {
    return __awaiter(this, void 0, void 0, function* () {
        const { children: posts1 } = yield reddit.getUserSaved({ limit: 100 });
        const ids = oldSaved.slice(0, 100);
        const { children: posts2 } = yield reddit.getPostInfos(ids);
        const posts = [...posts1, ...posts2];
        console.log('saved posts', posts.length);
        return posts;
    });
}
function handleDownloadError(saved, error) {
    return __awaiter(this, void 0, void 0, function* () {
        consecutiveFailures++;
        if (error instanceof Error) {
            console.error(`Error processing ${saved.name}:`, error.message);
            // Handle specific error types that should reset failure counter
            if (error.message.includes('removed') ||
                error.message.includes('blocked domain') ||
                error.message.includes('access forbidden')) {
                console.log('Post removed, blocked, or forbidden - not counting as consecutive failure:', saved);
                oldSaved = oldSaved.filter(id => id !== saved.name);
                consecutiveFailures = 0; // Reset on known non-network issues
                return reddit.setUserUnsaved(saved.name);
            }
        }
        issuePosts.push({
            err: error instanceof Error ? error.message : JSON.stringify(error),
            id: saved.name,
        });
        // Early termination check
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            console.warn(`⚠️ ${MAX_CONSECUTIVE_FAILURES} consecutive failures reached. Terminating early to prevent infinite loop.`);
            throw new Error(`Too many consecutive failures (${MAX_CONSECUTIVE_FAILURES}). Terminating.`);
        }
        console.error(`Failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}:`, error, saved);
    });
}
function downloadPosts(posts) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`📥 Starting to process ${posts.length} posts in batches of ${BATCH_SIZE}`);
        // Process posts in batches to avoid overwhelming APIs
        for (let i = 0; i < posts.length; i += BATCH_SIZE) {
            const batch = posts.slice(i, i + BATCH_SIZE);
            console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(posts.length / BATCH_SIZE)} (posts ${i + 1}-${Math.min(i + BATCH_SIZE, posts.length)})`);
            for (const { data: saved } of batch) {
                processedCount++;
                console.log(`\n📋 Processing post ${processedCount}/${posts.length}: ${saved.name}`);
                if (exports.stored.find(item => item.id === saved.id)) {
                    console.log('✅ already saved', saved.name);
                    yield reddit.setUserUnsaved(saved.name);
                    consecutiveFailures = 0; // Reset on success
                    continue;
                }
                try {
                    if (saved.url.includes('www.reddit.com/gallery/')) {
                        const galleryId = saved.url.split('/').pop();
                        if (galleryId) {
                            const response = yield reddit.getPostInfos([`t3_${galleryId}`]);
                            if (response.children.length !== 0) {
                                const galleryPost = response.children[0].data;
                                saved.gallery_data = galleryPost.gallery_data;
                                saved.media_metadata = galleryPost.media_metadata;
                            }
                        }
                    }
                    if (saved.gallery_data && saved.media_metadata) {
                        yield processGalleryPost(saved); // Type assertion to handle optional properties
                    }
                    else {
                        yield processSinglePost(saved);
                    }
                    consecutiveFailures = 0; // Reset on success
                    yield (0, promises_1.writeFile)('./stored.json', JSON.stringify(exports.stored, null, 2));
                }
                catch (error) {
                    yield handleDownloadError(saved, error);
                }
                // Rate limiting
                yield sleep(RATE_LIMIT_DELAY);
            }
            // Longer delay between batches
            if (i + BATCH_SIZE < posts.length) {
                console.log('⏳ Waiting before next batch...');
                yield sleep(RATE_LIMIT_DELAY * 3);
            }
        }
    });
}
function processGalleryPost(saved) {
    return __awaiter(this, void 0, void 0, function* () {
        const orgUrls = [];
        const cdnUrls = [];
        const msgIds = [];
        const msgUrls = [];
        let height = 0;
        let width = 0;
        for (const { media_id } of saved.gallery_data.items) {
            const index = saved.gallery_data.items.findIndex((item) => item.media_id === media_id);
            const media = saved.media_metadata[media_id];
            const ext = media.m.split('/').pop();
            if (!ext)
                continue;
            try {
                const url = `https://i.redd.it/${String(media_id)}.${String(ext)}`;
                console.log('downloading gallery item', String(media_id), url);
                const file = yield downloader_1.downloader.download(url);
                const upload = yield uploadFile(`${String(saved.name)}.${String(index)}.${file.ext}`, file.stream);
                if (index === 0) {
                    const res = yield (0, mediaResolution_1.getMediaResolution)(upload.filePath);
                    height = res.height;
                    width = res.width;
                }
                orgUrls.push(url);
                cdnUrls.push(upload.path);
                msgIds.push(upload.id);
                msgUrls.push(upload.url);
            }
            catch (error) {
                console.warn(`Failed to process gallery item ${String(media_id)}:`, error);
                // Continue with other items instead of failing entire gallery
            }
        }
        if (orgUrls.length > 0) {
            exports.stored.push({
                id: saved.id,
                title: saved.title,
                name: saved.name,
                orgUrl: orgUrls,
                cdnUrl: cdnUrls,
                msgId: msgIds,
                msgUrl: msgUrls,
                created: saved.created,
                height,
                width,
            });
        }
        else {
            throw new Error('No gallery items could be processed');
        }
    });
}
function processSinglePost(saved) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('downloading single post', saved.name, saved.url);
        const file = yield downloader_1.downloader.download(saved.url);
        const upload = yield uploadFile(`${String(saved.name)}.${file.ext}`, file.stream);
        const { height, width } = yield (0, mediaResolution_1.getMediaResolution)(upload.filePath);
        exports.stored.push({
            id: saved.id,
            title: saved.title,
            name: saved.name,
            orgUrl: saved.url,
            cdnUrl: upload.path,
            msgId: upload.id,
            msgUrl: upload.url,
            created: saved.created,
            height,
            width,
        });
    });
}
discord.login(config_1.config.DISCORD_TOKEN)
    .then(getRedditPosts)
    .then(downloadPosts)
    .then(() => (0, clips_1.getPinnedClips)(discord))
    .then((clips) => __awaiter(void 0, void 0, void 0, function* () {
    const channel = yield getChannel();
    for (const clip of clips) {
        // send clip to channel
        if (typeof clip.cdnUrl !== 'string')
            continue;
        yield channel.send(clip.cdnUrl);
        exports.stored.push(clip);
    }
}))
    .then(() => __awaiter(void 0, void 0, void 0, function* () {
    oldSaved = oldSaved.filter(id => !exports.stored.find(item => item.name === id));
    yield (0, promises_1.writeFile)('./old.saved.json', JSON.stringify(oldSaved, null, 2));
    yield (0, promises_1.writeFile)('./stored.json', JSON.stringify(exports.stored, null, 2));
    discord.destroy();
    console.log('done, issues:', issuePosts.length);
    // sort by error texts by alphabet
    console.log(issuePosts.sort((a, b) => a.err.localeCompare(b.err)));
    const listing = `https://www.reddit.com/api/info?id=${issuePosts.map(i => i.id).join(',')}`;
    console.log(listing);
    // write issues to file
    yield (0, promises_1.writeFile)('./issues.json', JSON.stringify({
        count: issuePosts.length,
        listing,
        posts: issuePosts,
    }, null, 2));
    console.log('\n✅ Reddit backup completed successfully!');
    console.log(`📊 Summary: ${exports.stored.length} posts saved, ${issuePosts.length} issues`);
}))
    .catch((error) => __awaiter(void 0, void 0, void 0, function* () {
    console.error('💥 Fatal error during backup:', error);
    // Save current progress even on error
    try {
        oldSaved = oldSaved.filter(id => !exports.stored.find(item => item.name === id));
        yield (0, promises_1.writeFile)('./old.saved.json', JSON.stringify(oldSaved, null, 2));
        yield (0, promises_1.writeFile)('./stored.json', JSON.stringify(exports.stored, null, 2));
        // Add the termination error to issues
        issuePosts.push({
            err: error instanceof Error ? error.message : 'unknown error',
            id: 'TERMINATED'
        });
        yield (0, promises_1.writeFile)('./issues.json', JSON.stringify({
            count: issuePosts.length,
            listing: '',
            posts: issuePosts,
        }, null, 2));
        console.log(`💾 Progress saved: ${exports.stored.length} posts, ${issuePosts.length} issues`);
    }
    catch (saveError) {
        console.error('❌ Failed to save progress:', saveError);
    }
    discord.destroy();
    process.exit(1);
}));
