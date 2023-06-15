import * as Discord from 'discord.js'
import { writeFile } from 'fs/promises'
import { config } from './modules/config'
import { downloader } from './modules/downloader'
import { Reddit } from './modules/reddit'
// import stored from './stored.json'

const stored = [] as any[]
const discord = new Discord.Client({
  intents: ['GuildMessages'],
})

discord.login(config.DISCORD_TOKEN).then(async () => {
  // send message in test channel with id 1118929807057616937
  const channel = await discord.channels.fetch('1118929807057616937')
  if (!channel?.isTextBased()) return
  const reddit = new Reddit(config.CLIENT_ID, config.CLIENT_SECRET, config.REDDIT_USERNAME, config.REDDIT_PASSWORD)

  const data = await reddit.getUserSaved({ limit: 100 })
  console.log('saved posts', data.children.length)

  for (const { data: saved } of data.children) {
    if (saved.gallery_data && saved.media_metadata) {
      for (const { media_id } of saved.gallery_data.items) {
        const index = saved.gallery_data.items.findIndex(item => item.media_id === media_id)
        const media = saved.media_metadata[media_id]
        const ext = media.m.split('/').pop()
        if (!ext) continue
        try {
          const file = await downloader.download(`https://i.redd.it/${media_id}.${ext}`)
          await writeFile(`./media/${saved.name}.${index}.${file.ext}`, file.buffer)
        } catch (error) {
          console.error(error, saved)
        }
      }
    } else {
      try {
        const file = await downloader.download(saved.url)
        const message = await channel.send({
          files: [new Discord.AttachmentBuilder(file.buffer, { name: `${saved.name}.${file.ext}` })],
        })
        const cdnUrl = message.attachments.first()?.url
        stored.push({
          name: saved.name,
          orgUrl: saved.url,
          cdnUrl,
          message: message.id,
        })
        console.log(cdnUrl)
        message.delete()
        await writeFile(`./media/${saved.name}.${file.ext}`, file.buffer)
      } catch (error) {
        console.error(error, saved)
      }
    }
  }
}).then(async () => {
  await writeFile('./stored.json', JSON.stringify(stored, null, 2))
  discord.destroy()
})
// get all guilds
