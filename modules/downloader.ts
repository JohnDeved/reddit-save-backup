import { fetch } from 'undici'
import { load as loadHtml } from 'cheerio'

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

  catbox (url: string) {
    const regex = /\.(\w{3,4})(\?.*)?$/
    const ext = url.match(regex)?.[1]
    if (!ext) throw new Error(`catbox unexpected URL ${url}`)
    if (!['jpg', 'png', 'gif', 'mp4'].includes(ext)) throw new Error(`catbox unsupported extension ${ext}`)

    return fetch(url)
      .then(response => response.arrayBuffer())
      .then(buffer => Buffer.from(buffer))
      .then(buffer => ({ buffer, ext }))
  }

  redgifs (url: string) {
    // make use of og meta tags to get the video URL
    // og:video
    // <meta property="og:video" content="https://thumbs2.redgifs.com/UnsightlyUnsungGermanshorthairedpointer-mobile.mp4">

    return fetch(url)
      .then(response => response.text())
      .then(html => {
        const $ = loadHtml(html)
        const videoUrl = $('meta[property="og:video"]').attr('content')
        if (!videoUrl) throw new Error(`redgifs unexpected URL ${url}`)
        return videoUrl
      })
      .then(videoUrl => fetch(videoUrl))
      .then(response => response.arrayBuffer())
      .then(buffer => Buffer.from(buffer))
      .then(buffer => ({ buffer, ext: 'mp4' }))
  }

  download (url: string) {
    const { hostname } = new URL(url)
    console.log('downloading', url)

    if (hostname === 'imgur.com') return this.ireddit(url)
    if (hostname === 'i.imgur.com') return this.imgur(url)
    if (hostname === 'i.redd.it') return this.ireddit(url)
    if (hostname === 'files.catbox.moe') return this.catbox(url)
    if (hostname === 'www.redgifs.com') return this.redgifs(url)
    if (hostname === 'redgifs.com') return this.redgifs(url)

    throw new Error(`unsupported URL ${hostname} ${url}`)
  }
}

export const downloader = new Downloader()
