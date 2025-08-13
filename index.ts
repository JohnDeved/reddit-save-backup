import * as Discord from 'discord.js'
import { createReadStream, createWriteStream, existsSync, readFileSync } from 'fs'
import { stat, writeFile, unlink } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { Readable } from 'stream'
import z from 'zod'
import { config } from './modules/config'
import { downloader } from './modules/downloader'
import { Reddit } from './modules/reddit'
import { compressMedia } from './modules/compress'
import { getMediaResolution } from './modules/mediaResolution'
import { getPinnedClips } from './modules/clips'

// Performance and reliability improvements
const MAX_CONSECUTIVE_FAILURES = 10
const RATE_LIMIT_DELAY = 1000 // 1 second between requests
const BATCH_SIZE = 20 // Process posts in batches

// Track consecutive failures for early termination
let consecutiveFailures = 0
let processedCount = 0

function sanitizeFileName (name: string): string {
  // Remove or replace problematic characters and limit length
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100) // Limit length to prevent "File name too long" errors
}

async function sleep (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ffmpeg.input()
const reddit = new Reddit(config.CLIENT_ID, config.CLIENT_SECRET, config.REDDIT_USERNAME, config.REDDIT_PASSWORD)

const discord = new Discord.Client({
  intents: ['GuildMessages'],
})

const issuePosts: Array<{
  err: string
  id: string
}> = []

export const stored = z.array(z.object({
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
  const sanitizedName = sanitizeFileName(name)
  const filePath = `./media/${sanitizedName}`
  // check if file exists
  let cached = false
  if (!existsSync(filePath)) {
    if (!file) throw new Error('File stream is required for new downloads')
    const writeStream = createWriteStream(filePath)
    // Convert web ReadableStream to Node.js readable stream if needed
    const nodeStream = file.pipe ? file : Readable.fromWeb(file)
    await pipeline(nodeStream, writeStream)
    console.log(`downloaded file ${filePath}`)
  } else {
    // kill stream
    console.log(`using cached file ${filePath}`)
    // file.cancel()
    cached = true
  }
  // get file size
  const { size } = await stat(filePath)

  // check if file is bigger than 10mb
  if (size > 10 * 1024 * 1024) {
    console.log(`file is bigger than 10mb ${filePath}, trying to compress`)
    const compPath = await compressMedia(filePath)
    const compName = compPath.split('/').pop()
    if (!compName) throw new Error('no compressed name')
    return uploadFile(compName)
  }

  // check if file is smaller than 8kb
  if (size < 8 * 1024) {
    throw new Error(`file is smaller than 8kb ${filePath}, there must be something wrong`)
  }

  console.log(`uploading file ${filePath}, size: ${size}`)

  const channel = await getChannel()
  const readStream = createReadStream(filePath)
  const message = await channel.send({ files: [new Discord.AttachmentBuilder(readStream, { name: sanitizedName })] })
  const path = message.attachments.first()?.url
  if (!path) throw new Error('attachment not found')

  // await unlink(filePath)
  return {
    filePath,
    path,
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

async function handleDownloadError (saved: { name: string, [key: string]: any }, error: unknown) {
  consecutiveFailures++

  if (error instanceof Error) {
    console.error(`Error processing ${saved.name}:`, error.message)
    if (error.message.includes('removed')) {
      console.log('seems to be removed', saved)
      oldSaved = oldSaved.filter(id => id !== saved.name)
      consecutiveFailures = 0 // Reset on successful removal detection
      return reddit.setUserUnsaved(saved.name)
    }
  }

  issuePosts.push({
    err: error instanceof Error ? error.message : JSON.stringify(error),
    id: saved.name,
  })

  // Early termination check
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    console.warn(`⚠️ ${MAX_CONSECUTIVE_FAILURES} consecutive failures reached. Terminating early to prevent infinite loop.`)
    throw new Error(`Too many consecutive failures (${MAX_CONSECUTIVE_FAILURES}). Terminating.`)
  }

  console.error(`Failure ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}:`, error, saved)
}

async function downloadPosts (posts: Awaited<ReturnType<typeof getRedditPosts>>) {
  console.log(`📥 Starting to process ${posts.length} posts in batches of ${BATCH_SIZE}`)

  // Process posts in batches to avoid overwhelming APIs
  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE)
    console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(posts.length / BATCH_SIZE)} (posts ${i + 1}-${Math.min(i + BATCH_SIZE, posts.length)})`)

    for (const { data: saved } of batch) {
      processedCount++
      console.log(`\n📋 Processing post ${processedCount}/${posts.length}: ${saved.name}`)

      if (stored.find(item => item.id === saved.id)) {
        console.log('✅ already saved', saved.name)
        await reddit.setUserUnsaved(saved.name)
        consecutiveFailures = 0 // Reset on success
        continue
      }

      try {
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
          await processGalleryPost(saved as any) // Type assertion to handle optional properties
        } else {
          await processSinglePost(saved)
        }

        consecutiveFailures = 0 // Reset on success
        await writeFile('./stored.json', JSON.stringify(stored, null, 2))
      } catch (error) {
        await handleDownloadError(saved, error)
      }

      // Rate limiting
      await sleep(RATE_LIMIT_DELAY)
    }

    // Longer delay between batches
    if (i + BATCH_SIZE < posts.length) {
      console.log('⏳ Waiting before next batch...')
      await sleep(RATE_LIMIT_DELAY * 3)
    }
  }
}

async function processGalleryPost (saved: { name: string, gallery_data: any, media_metadata: any, id: string, title: string, created: number }) {
  const orgUrls: string[] = []
  const cdnUrls: string[] = []
  const msgIds: string[] = []
  const msgUrls: string[] = []
  let height = 0
  let width = 0

  for (const { media_id } of saved.gallery_data.items) {
    const index = saved.gallery_data.items.findIndex((item: { media_id: string }) => item.media_id === media_id)
    const media = saved.media_metadata[media_id]
    const ext = media.m.split('/').pop()
    if (!ext) continue

    try {
      const url = `https://i.redd.it/${String(media_id)}.${String(ext)}`
      console.log('downloading gallery item', String(media_id), url)
      const file = await downloader.download(url)
      const upload = await uploadFile(`${String(saved.name)}.${String(index)}.${file.ext}`, file.stream)
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
      console.warn(`Failed to process gallery item ${String(media_id)}:`, error)
      // Continue with other items instead of failing entire gallery
    }
  }

  if (orgUrls.length > 0) {
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
  } else {
    throw new Error('No gallery items could be processed')
  }
}

async function processSinglePost (saved: { name: string, url: string, id: string, title: string, created: number }) {
  console.log('downloading single post', saved.name, saved.url)
  const file = await downloader.download(saved.url)
  const upload = await uploadFile(`${String(saved.name)}.${file.ext}`, file.stream)
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
}

discord.login(config.DISCORD_TOKEN)
  .then(getRedditPosts)
  .then(downloadPosts)
  .then(() => getPinnedClips(discord))
  .then(async (clips) => {
    const channel = await getChannel()
    for (const clip of clips) {
      // send clip to channel
      if (typeof clip.cdnUrl !== 'string') continue
      await channel.send(clip.cdnUrl)
      stored.push(clip)
    }
  })
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
