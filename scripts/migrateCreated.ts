import { readFileSync, writeFileSync } from 'fs'
import z from 'zod'
import { Reddit } from '../modules/reddit'
import { config } from '../modules/config'

const stored = z.array(z.object({
  id: z.string(),
  title: z.string(),
  name: z.string(),
  orgUrl: z.string().url().or(z.array(z.string().url())),
  cdnUrl: z.string().url().or(z.array(z.string().url())),
  msgId: z.string().or(z.array(z.string())),
  msgUrl: z.string().or(z.array(z.string())),
  created: z.number().optional(),
})).parse(JSON.parse(readFileSync('./stored.json', 'utf8')))

const reddit = new Reddit(config.CLIENT_ID, config.CLIENT_SECRET, config.REDDIT_USERNAME, config.REDDIT_PASSWORD)

function sleep (ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

addCreated()
async function addCreated () {
  // for every batch of 100
  for (let i = 0; i < stored.length; i += 100) {
    const batch = stored.slice(i, i + 100)
    console.log('batch', i, batch.length)
    await sleep(1000) // rate limit
    const infos = await reddit.getPostInfos(batch.map(({ name }) => name))
    for (const { data } of infos.children) {
      const { created, id } = data
      const index = stored.findIndex((item) => item.id === id)
      if (index === -1) {
        console.log('missing', id)
        continue
      }
      stored[index].created = created
    }
  }

  writeFileSync('./stored.json', JSON.stringify(stored, null, 2))
}
