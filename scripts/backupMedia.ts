import { pipeline } from 'stream/promises'
import stored from '../stored.json'
import { createWriteStream, existsSync } from 'fs'

const backupPath = '/Users/johannberger/Library/CloudStorage/GoogleDrive-johann@objekt.stream/Shared drives/Backups/Saved'

main()
async function main () {
  const urls = stored.map(s => s.cdnUrl).flat()
  let downloaded = 0
  for (const url of urls) {
    downloaded++
    const fileName = url.split('/').pop()
    if (!fileName) continue
    const filePath = `${backupPath}/${fileName}`
    if (existsSync(filePath)) continue
    const res = await fetch(url)

    console.log(`downloading ${downloaded}/${urls.length} ${fileName}`)
    await pipeline(res.body as any, createWriteStream(filePath))
  }
}
