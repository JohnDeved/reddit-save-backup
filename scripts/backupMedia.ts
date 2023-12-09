import { pipeline } from 'stream/promises'
import stored from '@undefined/saved'
import { createWriteStream, existsSync, rename, renameSync } from 'fs'
import path from 'path'

const backupPath = path.resolve(__dirname, '../media')

main()
async function main () {
  const urls = stored.map(s => s.cdnUrl).flat()
  let downloaded = 0
  for (const url of urls) {
    downloaded++
    let fileName = url.split('/').pop()
    if (!fileName) continue

    if (fileName.includes('?')) {
      const fileNameStrp = fileName.split('?').shift()!

      if (existsSync(`${backupPath}/${fileName}`)) {
        console.log('renaming', fileName, fileNameStrp)
        renameSync(`${backupPath}/${fileName}`, `${backupPath}/${fileNameStrp}`)
      }

      fileName = fileNameStrp
    }

    const filePath = `${backupPath}/${fileName}`
    if (existsSync(filePath)) continue
    const res = await fetch(url)

    console.log(`downloading ${downloaded}/${urls.length} ${fileName}`, 'at url', url)
    await pipeline(res.body as any, createWriteStream(filePath))
  }
}
