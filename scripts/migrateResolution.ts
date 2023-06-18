import { readFileSync, writeFileSync } from 'fs'
import z from 'zod'
import pLimit from 'p-limit'
import { getMediaResolution } from '../modules/mediaResolution'

const stored = z.array(z.object({
  id: z.string(),
  title: z.string(),
  name: z.string(),
  orgUrl: z.string().url().or(z.array(z.string().url())),
  cdnUrl: z.string().url().or(z.array(z.string().url())),
  msgId: z.string().or(z.array(z.string())),
  msgUrl: z.string().or(z.array(z.string())),
  created: z.number(),
  height: z.number().optional(),
  width: z.number().optional(),
})).parse(JSON.parse(readFileSync('./stored.json', 'utf8')))

migrateResolution()
async function migrateResolution () {
  const limit = pLimit(10)
  const promises = stored.map((item, i) => limit(async () => {
    // skip if already has resolution
    if (item.height && item.width) return

    const media = Array.isArray(item.cdnUrl) ? item.cdnUrl[0] : item.cdnUrl
    const res = await getMediaResolution(media)

    const perc = Math.round((i / stored.length) * 1000) / 10
    console.log(item.cdnUrl, res, i, limit.pendingCount, `${perc}%`)

    stored[i].height = res.height
    stored[i].width = res.width
  }))

  await Promise.all(promises)

  writeFileSync('./stored.json', JSON.stringify(stored, null, 2))
}
