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
exports.getPinnedClips = void 0;
// import { config } from './config'
function getPinnedClips(discord) {
    return __awaiter(this, void 0, void 0, function* () {
        const channel = yield discord.channels.fetch('1187777936657481728');
        if (!(channel === null || channel === void 0 ? void 0 : channel.isTextBased()))
            throw new Error('channel is not text based');
        const messages = yield channel.messages.fetchPinned();
        const clipsAsStored = [];
        for (const message of messages.values()) {
            if (!message.attachments.first())
                continue;
            if (!message.embeds[0])
                continue;
            // check if message is already stored by checking if it has a checkmark reaction
            if (message.reactions.cache.get('✅')) {
                yield message.unpin();
                continue;
            }
            clipsAsStored.push({
                created: message.createdTimestamp,
                msgId: message.id,
                msgUrl: message.url,
                id: message.embeds[0].url.split('viewkey=')[1],
                name: `ph_${message.embeds[0].url.split('viewkey=')[1]}`,
                cdnUrl: message.attachments.first().url,
                height: message.attachments.first().height,
                width: message.attachments.first().width,
                orgUrl: message.embeds[0].url,
                title: message.embeds[0].title,
            });
            // add reaction to message with checkmark
            yield message.react('✅');
            yield message.unpin();
        }
        return clipsAsStored;
    });
}
exports.getPinnedClips = getPinnedClips;
// const discord = new Discord.Client({
//   intents: ['GuildMessages'],
// })
// discord.login(config.DISCORD_TOKEN).then(async () => {
//   console.log(await getPinnedClips(discord))
//   discord.destroy()
// })
