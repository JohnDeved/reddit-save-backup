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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Reddit = void 0;
const undici_1 = require("undici");
const zod_1 = __importDefault(require("zod"));
const util_1 = require("util");
// Add timeout and retry configuration for Reddit API
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
                console.warn(`Reddit API attempt ${attempt}/${MAX_RETRIES} failed for ${url}:`, error);
                if (attempt < MAX_RETRIES) {
                    yield new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
                }
            }
        }
        throw lastError !== null && lastError !== void 0 ? lastError : new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`);
    });
}
class Reddit {
    constructor(clientId, clientSecret, username, password) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.username = username;
        this.password = password;
        this._token = null;
        this._tokenExpiresAt = null;
        this._redditTokenSchema = zod_1.default.object({
            access_token: zod_1.default.string(),
            token_type: zod_1.default.string(),
            expires_in: zod_1.default.number(),
            scope: zod_1.default.string(),
        });
        this._listingOptSchema = zod_1.default.object({
            before: zod_1.default.string().optional(),
            after: zod_1.default.string().optional(),
            count: zod_1.default.number().optional(),
            limit: zod_1.default.number().optional(),
            show: zod_1.default.string().optional(),
        });
        this._getUserSavedSchema = this._listingOptSchema.extend({
            username: zod_1.default.string().optional(),
        });
        this._listingSchema = zod_1.default.object({
            kind: zod_1.default.literal('Listing'),
            data: zod_1.default.object({
                after: zod_1.default.string().nullable(),
                before: zod_1.default.string().nullable(),
                modhash: zod_1.default.string().nullable(),
                children: zod_1.default.array(zod_1.default.object({
                    kind: zod_1.default.literal('t3'),
                    data: zod_1.default.object({
                        id: zod_1.default.string(),
                        created: zod_1.default.number(),
                        title: zod_1.default.string(),
                        name: zod_1.default.string(),
                        permalink: zod_1.default.string(),
                        url: zod_1.default.string(),
                        media_metadata: zod_1.default.record(zod_1.default.string(), zod_1.default.object({
                            m: zod_1.default.string(),
                        })).nullable().optional(),
                        gallery_data: zod_1.default.object({
                            items: zod_1.default.array(zod_1.default.object({
                                media_id: zod_1.default.string(),
                            })),
                        }).nullable().optional(),
                        domain: zod_1.default.string(),
                    }),
                })),
            }),
        });
    }
    getToken() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._token) {
                if (this._tokenExpiresAt && this._tokenExpiresAt > Date.now()) {
                    return this._token;
                }
            }
            const myHeaders = new undici_1.Headers();
            myHeaders.append('Authorization', `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`);
            const formdata = new undici_1.FormData();
            formdata.append('grant_type', 'password');
            formdata.append('username', this.username);
            formdata.append('password', this.password);
            const token = yield fetchWithRetry('https://www.reddit.com/api/v1/access_token', {
                method: 'POST',
                headers: myHeaders,
                body: formdata,
            })
                .then(response => response.json())
                .then(data => this._redditTokenSchema.parse(data));
            this._token = token;
            this._tokenExpiresAt = Date.now() + token.expires_in * 1000;
            return token;
        });
    }
    getAuthHeader() {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield this.getToken();
            const headers = new undici_1.Headers();
            headers.append('Authorization', `${token.token_type} ${token.access_token}`);
            return headers;
        });
    }
    fetch(path, method = 'GET', body) {
        return __awaiter(this, void 0, void 0, function* () {
            const headers = yield this.getAuthHeader();
            console.log(method, path);
            const data = yield fetchWithRetry(`https://oauth.reddit.com${path}`, { method, headers, body })
                .then(response => response.json());
            console.log(method, path, 'response', (0, util_1.inspect)(data, { colors: true, depth: null }));
            return data;
        });
    }
    get(path) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.fetch(path);
        });
    }
    post(path, body) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.fetch(path, 'POST', body);
        });
    }
    /**
     * Get a list of posts that the user has saved.
     * https://www.reddit.com/dev/api/#GET_user_{username}_saved
     */
    getUserSaved(options = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const _a = this._getUserSavedSchema.parse(options), { username = this.username } = _a, opt = __rest(_a, ["username"]);
            const response = yield this.get(`/user/${username}/saved?${new URLSearchParams(opt).toString()}`);
            return this._listingSchema.parse(response).data;
        });
    }
    getPostInfos(names) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.get(`/api/info?id=${names.join(',')}`);
            return this._listingSchema.parse(response).data;
        });
    }
    setUserUnsaved(name) {
        return __awaiter(this, void 0, void 0, function* () {
            const formData = new URLSearchParams();
            formData.append('id', name);
            return this.post('/api/unsave', formData);
        });
    }
}
exports.Reddit = Reddit;
