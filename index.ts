import * as Discord from 'discord.js'
import { createReadStream, createWriteStream, existsSync, readFileSync } from 'fs'
import { stat, writeFile, unlink } from 'fs/promises'
import { pipeline } from 'stream/promises'
import z from 'zod'
import { config } from './modules/config'
import { downloader } from './modules/downloader'
import { Reddit } from './modules/reddit'
import type { IncomingMessage } from 'http'

const reddit = new Reddit(config.CLIENT_ID, config.CLIENT_SECRET, config.REDDIT_USERNAME, config.REDDIT_PASSWORD)

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

const oldSaved = z.array(z.string()).parse(JSON.parse(readFileSync('./old.saved.json', 'utf8')))

async function getChannel () {
  const channel = await discord.channels.fetch('1118929807057616937')
  if (!channel?.isTextBased()) throw new Error('channel is not text based')
  return channel
}

async function uploadFile (name: string, file: IncomingMessage) {
  const filePath = `./media/${name}`
  // check if file exists
  if (!existsSync(filePath)) {
    const writeStream = createWriteStream(filePath)
    await pipeline(file, writeStream)
  }
  // get file size
  const { size } = await stat(filePath)

  // check if file is bigger than 25mb
  if (size > 25 * 1024 * 1024) {
    throw new Error(`file is bigger than 25mb ${filePath}`)
  }

  const channel = await getChannel()
  const readStream = createReadStream(filePath)
  const message = await channel.send({ files: [new Discord.AttachmentBuilder(readStream, { name })] })
  const path = message.attachments.first()?.url
  if (!path) throw new Error('attachment not found')

  await unlink(filePath)
  return {
    path: path,
    id: message.id,
    url: message.url,
  }
}

async function getRedditPosts () {
  const { children: posts1 } = await reddit.getUserSaved({ limit: 100 })

  // get first 50 entries of old saved posts
  const ids = oldSaved.slice(0, 50)
  const { children: posts2 } = await reddit.getPostInfos(ids)

  const posts = [...posts1, ...posts2]
  console.log('saved posts', posts.length)
  return posts
}

async function downloadPosts (posts: Awaited<ReturnType<typeof getRedditPosts>>) {
  for (const { data: saved } of posts) {
    if (stored.find(item => item.id === saved.id)) {
      console.log('already saved', saved.name)
      await reddit.setUserUnsaved(saved.name)
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
          const upload = await uploadFile(`${saved.name}.${index}.${file.ext}`, file.stream)
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
        const upload = await uploadFile(`${saved.name}.${file.ext}`, file.stream)
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
    const _oldSaved = oldSaved.filter(id => !stored.find(item => item.name === id))
    await writeFile('./old.saved.json', JSON.stringify(_oldSaved, null, 2))
    await writeFile('./stored.json', JSON.stringify(stored, null, 2))
    discord.destroy()
    console.log('done')
  })
// get all guilds
