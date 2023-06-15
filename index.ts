import { config } from './modules/config'
import { downloader } from './modules/downloader'
import { Reddit } from './modules/reddit'
import { inspect } from 'util'
import { writeFile } from 'fs/promises'

const reddit = new Reddit(config.CLIENT_ID, config.CLIENT_SECRET, config.REDDIT_USERNAME, config.REDDIT_PASSWORD)

// get saved posts
reddit.getUserSaved({ limit: 100 }).then(async data => {
  for (const { data: saved } of data.children) {
    const file = await downloader.download(saved.url)
    await writeFile(`./media/${saved.name}.${file.ext}`, file.buffer)
  }
})
