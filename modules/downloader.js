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
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloader = void 0;
const cheerio_1 = require("cheerio");
const undici_1 = require("undici");
const directExt = ['jpg', 'jpeg', 'png', 'gif', 'mp4'];
// Add timeout and retry configuration
const FETCH_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
function fetchWithTimeout(url, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT);
        try {
            const response = yield (0, undici_1.fetch)(url, Object.assign(Object.assign({}, options), { signal: controller.signal }));
            return response;
        }
        finally {
            clearTimeout(timeoutId);
        }
    });
}
function fetchWithRetry(url, options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        let lastError = null;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return yield fetchWithTimeout(url, options);
            }
            catch (error) {
                lastError = error;
                console.warn(`Fetch attempt ${attempt}/${MAX_RETRIES} failed for ${url}:`, error);
                if (attempt < MAX_RETRIES) {
                    yield new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
                }
            }
        }
        throw lastError !== null && lastError !== void 0 ? lastError : new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`);
    });
}
class Downloader {
    direct(url) {
        var _a;
        const regex = /\.(\w{3,4})(\?.*)?$/;
        const ext = (_a = url.match(regex)) === null || _a === void 0 ? void 0 : _a[1];
        if (!ext)
            throw new Error(`direct unexpected URL ${url}`);
        if (!directExt.includes(ext))
            throw new Error(`direct unsupported extension ${ext}`);
        return fetchWithRetry(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } })
            .then(response => {
            if (!response.ok)
                throw new Error(`direct unexpected BODY (removed) ${url} ${response.status}`);
            if (response.url.includes('removed'))
                throw new Error(`direct removed ${url}`);
            const contentType = response.headers.get('content-type');
            if (!(contentType === null || contentType === void 0 ? void 0 : contentType.includes('image')) && !(contentType === null || contentType === void 0 ? void 0 : contentType.includes('video')))
                throw new Error(`direct unexpected content-type ${contentType !== null && contentType !== void 0 ? contentType : ''} ${url}`);
            return response.body;
        })
            .then(stream => ({ stream, ext }));
    }
    redgifsDirect(url) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield fetchWithRetry('https://api.redgifs.com/v2/auth/temporary', {
                headers: {
                    origin: 'https://www.redgifs.com',
                    referer: 'https://www.redgifs.com/',
                },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch Redgifs token');
            }
            const data = yield response.json();
            const token = data.token;
            const regex = /\.(\w{3,4})(\?.*)?$/;
            const ext = (_a = url.match(regex)) === null || _a === void 0 ? void 0 : _a[1];
            if (!ext)
                throw new Error(`direct unexpected URL ${url}`);
            if (!directExt.includes(ext))
                throw new Error(`direct unsupported extension ${ext}`);
            const videoUrl = yield fetchWithRetry(url.split('/files/')[0], {
                headers: {
                    authorization: `Bearer ${token}`,
                },
            }).then(res => res.json()).then(res => res.gif.urls.hd);
            return fetchWithRetry(videoUrl)
                .then(response => {
                if (!response.ok)
                    throw new Error(`direct unexpected BODY (removed) ${url} ${response.status}`);
                if (response.url.includes('removed'))
                    throw new Error(`direct removed ${url}`);
                const contentType = response.headers.get('content-type');
                if (!(contentType === null || contentType === void 0 ? void 0 : contentType.includes('image')) && !(contentType === null || contentType === void 0 ? void 0 : contentType.includes('video')))
                    throw new Error(`direct unexpected content-type ${contentType !== null && contentType !== void 0 ? contentType : ''} ${url}`);
                return response.body;
            })
                .then(stream => ({ stream, ext }));
        });
    }
    ogMeta(url) {
        return fetchWithRetry(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
            .then(response => {
            console.log('ogMeta', url, response.status);
            if ([404, 410].includes(response.status))
                throw new Error(`ogMeta bad status (removed) ${url} ${response.status}`);
            if ([403, 429].includes(response.status))
                throw new Error(`ogMeta access forbidden ${url} ${response.status}`);
            if (!response.ok)
                throw new Error(`ogMeta unexpected status ${url} ${response.status}`);
            return response.text();
        })
            .then(html => {
            var _a, _b;
            const $ = (0, cheerio_1.load)(html);
            // get og:video or og:image
            const videoUrl = (_a = $('meta[property="og:video"]').attr('content')) !== null && _a !== void 0 ? _a : $('meta[property="og:video:url"]').attr('content');
            if (videoUrl)
                return videoUrl;
            const imageUrl = (_b = $('meta[property="og:image"]').attr('content')) !== null && _b !== void 0 ? _b : $('meta[property="og:image:url"]').attr('content');
            if (imageUrl)
                return imageUrl;
            throw new Error(`og:video or og:image not found (removed) ${url}`);
        })
            .then(url => {
            var _a;
            console.log('ogMeta url', url);
            // strip everything after ?
            const regex = /^(.*?)(\?.*)?$/;
            const match = (_a = url.match(regex)) === null || _a === void 0 ? void 0 : _a[1];
            if (!match)
                throw new Error(`og:video or og:image unexpected URL ${url}`);
            return match;
        })
            .then(url => {
            // not needed anymore?
            // if (url.includes('redgifs.com')) {
            //   return this.redgifsDirect(url)
            // }
            return this.direct(url);
        });
    }
    download(url) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (!url.startsWith('http'))
                throw new Error(`download unexpected URL (removed) ${url}`);
            // Block unsupported domains that are known to cause issues
            const blockedDomains = ['pornhub.com', 'xvideos.com', 'xnxx.com'];
            const { hostname } = new URL(url);
            if (blockedDomains.some(domain => hostname.includes(domain))) {
                throw new Error(`download blocked domain ${hostname} - unsupported site`);
            }
            const { pathname } = new URL(url);
            if (directExt.some(ext => pathname.endsWith(`.${ext}`))) {
                // check if content-type
                const { headers } = yield fetchWithRetry(url, { method: 'HEAD' });
                const contentType = headers.get('content-type');
                if ((_a = contentType === null || contentType === void 0 ? void 0 : contentType.includes('image')) !== null && _a !== void 0 ? _a : contentType === null || contentType === void 0 ? void 0 : contentType.includes('video')) {
                    if (url.includes('redgifs.com')) {
                        return this.redgifsDirect(url);
                    }
                    return this.direct(url);
                }
            }
            return this.ogMeta(url);
        });
    }
}
exports.downloader = new Downloader();
