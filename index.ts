import * as Discord from 'discord.js'
import { createReadStream, createWriteStream, existsSync, readFileSync } from 'fs'
import { stat, writeFile, unlink } from 'fs/promises'
import { pipeline } from 'stream/promises'
import z from 'zod'
import { config } from './modules/config'
import { downloader } from './modules/downloader'
import { Reddit } from './modules/reddit'
import { compressMedia } from './modules/compress'
import { getMediaResolution } from './modules/mediaResolution'
// import Ffmpeg from 'fluent-ffmpeg'
// const ffmpeg = Ffmpeg()

// ffmpeg.input()
const reddit = new Reddit(config.CLIENT_ID, config.CLIENT_SECRET, config.REDDIT_USERNAME, config.REDDIT_PASSWORD)

const discord = new Discord.Client({
  intents: ['GuildMessages'],
})

const issuePosts: Array<{
  err: string
  id: string
}> = []

const stored = z.array(z.object({
  id: z.string(),
  title: z.string(),
  name: z.string(),
  orgUrl: z.string().url().or(z.array(z.string().url())),
  cdnUrl: z.string().url().or(z.array(z.string().url())),
  msgId: z.string().or(z.array(z.string())),
  msgUrl: z.string().or(z.array(z.string())),
  created: z.number(),
  height: z.number(),
  width: z.number(),
})).parse(JSON.parse(readFileSync('./stored.json', 'utf8')))

let oldSaved = z.array(z.string()).parse(JSON.parse(readFileSync('./old.saved.json', 'utf8')))

async function getChannel () {
  const channel = await discord.channels.fetch('1118929807057616937')
  if (!channel?.isTextBased()) throw new Error('channel is not text based')
  return channel
}

async function uploadFile (name: string, file?: any): Promise<{ filePath: string, path: string, id: string, url: string }> {
  const filePath = `./media/${name}`
  // check if file exists
  let cached = false
  if (!existsSync(filePath)) {
    const writeStream = createWriteStream(filePath)
    await pipeline(file, writeStream)
    console.log(`downloaded file ${filePath}`)
  } else {
    // kill stream
    console.log(`using cached file ${filePath}`)
    // file.cancel()
    cached = true
  }
  // get file size
  const { size } = await stat(filePath)

  // check if file is bigger than 25mb
  if (size > 25 * 1024 * 1024) {
    console.log(`file is bigger than 25mb ${filePath}, trying to compress`)
    const compPath = await compressMedia(filePath)
    const compName = compPath.split('/').pop()
    if (!compName) throw new Error('no compressed name')
    return uploadFile(compName)
  }

  // check if file is smaller than 8kb
  if (size < 8 * 1024) {
    throw new Error(`file is smaller than 8kb ${filePath}, there must be something wrong`)
  }

  if (cached) {
    // bypass compressed files for now
    if (!filePath.endsWith('_c.mp4') && !filePath.endsWith('_cl.mp4')) {
      // throw error until wierd upload bug is fixed
      throw new Error(`file upload aborted ${filePath}`)
    }
  }

  const channel = await getChannel()
  const readStream = createReadStream(filePath)
  const message = await channel.send({ files: [new Discord.AttachmentBuilder(readStream, { name })] })
  const path = message.attachments.first()?.url
  if (!path) throw new Error('attachment not found')

  // await unlink(filePath)
  return {
    filePath,
    path: path,
    id: message.id,
    url: message.url,
  }
}

async function getRedditPosts () {
  const { children: posts1 } = await reddit.getUserSaved({ limit: 100 })

  const ids = oldSaved.slice(0, 100)
  const { children: posts2 } = await reddit.getPostInfos(ids)

  const posts = [...posts1, ...posts2]
  console.log('saved posts', posts.length)
  return posts
}

async function handleDownloadError (saved: any, error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('remove')) {
      if (error.message.includes('removed')) {
        console.log('seems to be removed', saved)
      } else {
        console.log('removing', saved)
      }
      oldSaved = oldSaved.filter(id => id !== saved.name)
      return reddit.setUserUnsaved(saved.name)
    }
  }

  issuePosts.push({
    err: error instanceof Error ? error.message : JSON.stringify(error),
    id: saved.name,
  })
  console.error(error, saved)
}

async function downloadPosts (posts: Awaited<ReturnType<typeof getRedditPosts>>) {
  for (const { data: saved } of posts) {
    if (stored.find(item => item.id === saved.id)) {
      console.log('already saved', saved.name)
      await reddit.setUserUnsaved(saved.name)
      continue
    }
    if (saved.url.includes('www.reddit.com/gallery/')) {
      const galleryId = saved.url.split('/').pop()
      if (galleryId) {
        const response = await reddit.getPostInfos([`t3_${galleryId}`])
        if (response.children.length !== 0) {
          const galleryPost = response.children[0].data
          saved.gallery_data = galleryPost.gallery_data
          saved.media_metadata = galleryPost.media_metadata
        }
      }
    }
    if (saved.gallery_data && saved.media_metadata) {
      const orgUrls: string[] = []
      const cdnUrls: string[] = []
      const msgIds: string[] = []
      const msgUrls: string[] = []
      let height = 0
      let width = 0
      for (const { media_id } of saved.gallery_data.items) {
        const index = saved.gallery_data.items.findIndex(item => item.media_id === media_id)
        const media = saved.media_metadata[media_id]
        const ext = media.m.split('/').pop()
        if (!ext) continue
        try {
          const url = `https://i.redd.it/${media_id}.${ext}`
          console.log('downloading', media_id, url)
          const file = await downloader.download(url)
          const upload = await uploadFile(`${saved.name}.${index}.${file.ext}`, file.stream)
          if (index === 0) {
            const res = await getMediaResolution(upload.filePath)
            height = res.height
            width = res.width
          }
          orgUrls.push(url)
          cdnUrls.push(upload.path)
          msgIds.push(upload.id)
          msgUrls.push(upload.url)
        } catch (error) {
          await handleDownloadError(saved, error)
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
        created: saved.created,
        height,
        width,
      })
      await writeFile('./stored.json', JSON.stringify(stored, null, 2))
    } else {
      try {
        console.log('downloading', saved.name, saved.url)
        const file = await downloader.download(saved.url)
        const upload = await uploadFile(`${saved.name}.${file.ext}`, file.stream)
        const { height, width } = await getMediaResolution(upload.filePath)
        stored.push({
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
        })
        await writeFile('./stored.json', JSON.stringify(stored, null, 2))
      } catch (error) {
        await handleDownloadError(saved, error)
      }
    }
  }
}

discord.login(config.DISCORD_TOKEN)
  .then(getRedditPosts)
  .then(downloadPosts)
  .then(async () => {
    oldSaved = oldSaved.filter(id => !stored.find(item => item.name === id))
    await writeFile('./old.saved.json', JSON.stringify(oldSaved, null, 2))
    await writeFile('./stored.json', JSON.stringify(stored, null, 2))
    discord.destroy()
    console.log('done, issues:', issuePosts.length)
    // sort by error texts by alphabet
    console.log(issuePosts.sort((a, b) => a.err.localeCompare(b.err)))
    const listing = `https://www.reddit.com/api/info?id=${issuePosts.map(i => i.id).join(',')}`
    console.log(listing)

    // write issues to file
    await writeFile('./issues.json', JSON.stringify({
      count: issuePosts.length,
      listing,
      posts: issuePosts,
    }, null, 2))
  })
