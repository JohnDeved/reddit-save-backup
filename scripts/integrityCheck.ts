import { fetch } from 'undici'
import stored from '../stored.json'
import oldSaved from '../old.saved.json'
import pLimit from 'p-limit'
import bytes from 'bytes'
import { existsSync, writeFileSync } from 'fs'
import { rm, stat } from 'fs/promises'

async function fetchRetry (url: Parameters<typeof fetch>[0], options?: Parameters<typeof fetch>[1]) {
  try {
    return await fetch(url, options)
  } catch (err) {
    if (err instanceof Error) console.error(err.message)
    return fetchRetry(url, options)
  }
}

check()
async function check () {
  const entries = stored.flatMap(entry => {
    if (!Array.isArray(entry.cdnUrl)) {
      return {
        url: entry.cdnUrl,
        name: entry.name,
      }
    }
    return entry.cdnUrl.map(url => ({
      url,
      name: entry.name,
    }))
  })

  const limit = pLimit(50)
  const promises = entries.map((entry, i) => limit(async () => {
    const { ok, status, headers } = await fetchRetry(entry.url, { method: 'HEAD' })
    const contentLength = headers.get('content-length')
    const perc = Math.round((i / entries.length) * 1000) / 10
    console.log(entry.url, status, i, limit.pendingCount, `${perc}%`)
    return {
      ok,
      status,
      contentLength,
      ...entry,
    }
  }))

  const results = await Promise.all(promises)
  const failed = results.filter(({ ok }) => !ok)
  console.log('not ok', failed)

  const total = results.reduce((acc, { contentLength }) => acc + Number(contentLength), 0)
  console.log('total size', bytes(total))

  const failedIds = failed.map(({ name }) => name)
  const newStored = stored.filter(({ name }) => !failedIds.includes(name))
  console.log('newStored', newStored.length, 'oldStored', stored.length)

  // remove failed from stored.json
  writeFileSync('./stored.json', JSON.stringify(newStored, null, 2))

  // add to the beginning of old.saved.json
  const newOldSaved = [...failedIds, ...oldSaved]
  writeFileSync('./old.saved.json', JSON.stringify(newOldSaved, null, 2))

  // check backup size
  const backupPath = '/Users/johannberger/Library/CloudStorage/GoogleDrive-johann@objekt.stream/Shared drives/Backups/Saved'

  // if backup path exists

  if (existsSync(backupPath)) {
    for (const { contentLength, ok, url } of results) {
      if (!ok) continue
      const fileName = url.split('/').pop()
      if (!fileName) return
      const filePath = `${backupPath}/${fileName}`
      const fileSize = Number(contentLength)

      const stats = await stat(filePath)
      const backupFileSize = stats.size

      if (fileSize !== backupFileSize) {
        console.log(`file size mismatch ${fileSize} !== ${backupFileSize}`, 'at', filePath, 'removing file')
        await rm(filePath)
      }
    }
  }
}
