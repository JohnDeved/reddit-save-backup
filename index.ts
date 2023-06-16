import * as Discord from 'discord.js'
import { readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import z from 'zod'
import { config } from './modules/config'
import { downloader } from './modules/downloader'
import { Reddit } from './modules/reddit'

const discord = new Discord.Client({
  intents: ['GuildMessages'],
})

const stored = z.array(z.object({
  id: z.string(),
  title: z.string(),
  name: z.string(),
  orgUrl: z.string().url().or(z.array(z.string().url())),
  cdnUrl: z.string().url().or(z.array(z.string().url())),
  msgId: z.string().or(z.array(z.string())),
  msgUrl: z.string().or(z.array(z.string())),
})).parse(JSON.parse(readFileSync('./stored.json', 'utf8')))

async function getChannel () {
  const channel = await discord.channels.fetch('1118929807057616937')
  if (!channel?.isTextBased()) throw new Error('channel is not text based')
  return channel
}

async function uploadFile (name: string, file: Buffer) {
  // check if file is bigger than 25mb
  if (file.byteLength > 25 * 1024 * 1024) {
    const path = `./media/${name}`
    await writeFile(path, file)
    throw new Error(`file is bigger than 25mb, saving to disk ${path}`)
  }

  const channel = await getChannel()
  const message = await channel.send({ files: [new Discord.AttachmentBuilder(file, { name })] })
  const path = message.attachments.first()?.url
  if (!path) throw new Error('attachment not found')
  return {
    path: path,
    id: message.id,
    url: message.url,
  }
}

async function getRedditPosts () {
  const reddit = new Reddit(config.CLIENT_ID, config.CLIENT_SECRET, config.REDDIT_USERNAME, config.REDDIT_PASSWORD)
  const posts = await reddit.getUserSaved({ limit: 100 })
  console.log('saved posts', posts.children.length)
  return posts
}

async function downloadPosts (posts: Awaited<ReturnType<typeof getRedditPosts>>) {
  for (const { data: saved } of posts.children) {
    if (stored.find(item => item.id === saved.id)) {
      console.log('already saved', saved.name)
      continue
    }
    if (saved.gallery_data && saved.media_metadata) {
      const orgUrls: string[] = []
      const cdnUrls: string[] = []
      const msgIds: string[] = []
      const msgUrls: string[] = []
      for (const { media_id } of saved.gallery_data.items) {
        const index = saved.gallery_data.items.findIndex(item => item.media_id === media_id)
        const media = saved.media_metadata[media_id]
        const ext = media.m.split('/').pop()
        if (!ext) continue
        try {
          const url = `https://i.redd.it/${media_id}.${ext}`
          const file = await downloader.download(url)
          // await writeFile(`./media/${saved.name}.${index}.${file.ext}`, file.buffer)
          const upload = await uploadFile(`${saved.name}.${index}.${file.ext}`, file.buffer)
          orgUrls.push(url)
          cdnUrls.push(upload.path)
          msgIds.push(upload.id)
          msgUrls.push(upload.url)
        } catch (error) {
          console.error(error, saved)
        }
      }
      stored.push({
        id: saved.id,
        title: saved.title,
        name: saved.name,
        orgUrl: orgUrls,
        cdnUrl: cdnUrls,
        msgId: msgIds,
        msgUrl: msgUrls,
      })
      await writeFile('./stored.json', JSON.stringify(stored, null, 2))
    } else {
      try {
        const file = await downloader.download(saved.url)
        const upload = await uploadFile(`${saved.name}.${file.ext}`, file.buffer)
        stored.push({
          id: saved.id,
          title: saved.title,
          name: saved.name,
          orgUrl: saved.url,
          cdnUrl: upload.path,
          msgId: upload.id,
          msgUrl: upload.url,
        })
        await writeFile('./stored.json', JSON.stringify(stored, null, 2))
      } catch (error) {
        console.error(error, saved)
      }
    }
  }
}

discord.login(config.DISCORD_TOKEN)
  .then(getRedditPosts)
  .then(downloadPosts)
  .then(async () => {
    await writeFile('./stored.json', JSON.stringify(stored, null, 2))
    discord.destroy()
  })
// get all guilds
