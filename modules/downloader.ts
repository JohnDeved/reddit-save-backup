import { fetch } from 'undici'

class Downloader {
  imgur (url: string) {
    const regex = /\.(\w{3,4})(\?.*)?$/
    const extension = url.match(regex)?.[1]
    if (!extension) throw new Error(`imgur unexpected URL ${url}`)
    if (!['jpg', 'png', 'gifv'].includes(extension)) throw new Error(`imgur unsupported extension ${extension}`)

    let ext = extension
    if (ext === 'gifv') {
      url = url.replace(regex, '.mp4')
      ext = 'mp4'
    }

    return fetch(url)
      .then(response => response.arrayBuffer())
      .then(buffer => Buffer.from(buffer))
      .then(buffer => ({ buffer, ext }))
  }

  ireddit (url: string) {
    const regex = /\.(\w{3,4})(\?.*)?$/
    const ext = url.match(regex)?.[1]
    if (!ext) throw new Error(`ireddit unexpected URL ${url}`)
    if (!['jpg', 'png', 'gif'].includes(ext)) throw new Error(`ireddit unsupported extension ${ext}`)

    return fetch(url)
      .then(response => response.arrayBuffer())
      .then(buffer => Buffer.from(buffer))
      .then(buffer => ({ buffer, ext }))
  }

  download (url: string) {
    const { hostname } = new URL(url)
    console.log('downloading', url)

    if (hostname === 'imgur.com') return this.ireddit(url)
    if (hostname === 'i.imgur.com') return this.imgur(url)
    if (hostname === 'i.redd.it') return this.ireddit(url)

    throw new Error(`unsupported URL ${hostname} ${url}`)
  }
}

export const downloader = new Downloader()
