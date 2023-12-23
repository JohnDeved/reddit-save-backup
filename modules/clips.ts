import type * as Discord from 'discord.js'
import type { stored } from '../index'
// import { config } from './config'

export async function getPinnedClips (discord: Discord.Client): Promise<typeof stored> {
  const channel = await discord.channels.fetch('1187777936657481728')
  if (!channel?.isTextBased()) throw new Error('channel is not text based')
  const messages = await channel.messages.fetchPinned()

  const clipsAsStored: typeof stored = []
  for (const message of messages.values()) {
    if (!message.attachments.first()) continue
    if (!message.embeds[0]) continue

    clipsAsStored.push({
      created: message.createdTimestamp,
      msgId: message.id,
      msgUrl: message.url,
      id: message.embeds[0].url!.split('viewkey=')[1],
      name: `ph_${message.embeds[0].url!.split('viewkey=')[1]}`,
      cdnUrl: message.attachments.first()!.url,
      height: message.attachments.first()!.height!,
      width: message.attachments.first()!.width!,
      orgUrl: message.embeds[0].url!,
      title: message.embeds[0].title!,
    })

    // add reaction to message with checkmark
    await message.react('✅')
    await message.unpin()
  }

  return clipsAsStored
}

// const discord = new Discord.Client({
//   intents: ['GuildMessages'],
// })

// discord.login(config.DISCORD_TOKEN).then(async () => {
//   console.log(await getPinnedClips(discord))
//   discord.destroy()
// })
