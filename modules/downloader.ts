import { load as loadHtml } from 'cheerio'
import { fetch } from 'undici'

class Downloader {
  direct (url: string) {
    const regex = /\.(\w{3,4})(\?.*)?$/
    const ext = url.match(regex)?.[1]
    if (!ext) throw new Error(`direct unexpected URL ${url}`)
    if (!['jpg', 'png', 'gif', 'mp4'].includes(ext)) throw new Error(`direct unsupported extension ${ext}`)

    return fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`direct unexpected BODY (removed) ${url}`)
        if (response.url.includes('removed')) throw new Error(`direct removed ${url}`)
        return response.body
      })
      .then(stream => ({ stream, ext }))
  }

  imgur (url: string) {
    const regex = /\.(\w{3,4})(\?.*)?$/
    const extension = url.match(regex)?.[1]
    if (!extension) throw new Error(`imgur unexpected URL ${url}`)
    if (!['jpg', 'png', 'gifv', 'gif'].includes(extension)) throw new Error(`imgur unsupported extension ${extension}`)

    let ext = extension
    if (ext === 'gifv') {
      url = url.replace(regex, '.mp4')
      ext = 'mp4'
    }

    return this.direct(url)
  }

  gfycat (url: string) {
    return fetch(url)
      .then(response => response.text())
      .then(html => {
        const $ = loadHtml(html)
        const videoUrl = $('meta[property="og:video"]').attr('content')
        if (!videoUrl) throw new Error(`gfycat og:video not found (removed) ${url}`)
        return videoUrl
      })
      .then(this.direct)
  }

  download (url: string) {
    const { hostname } = new URL(url)

    if (hostname.endsWith('imgur.com')) return this.imgur(url)
    if (hostname === 'i.redd.it') return this.direct(url)
    if (hostname === 'files.catbox.moe') return this.direct(url)
    if (hostname === 'cdn.awwni.me') return this.direct(url)
    if (hostname.endsWith('redgifs.com')) return this.gfycat(url)
    if (hostname.endsWith('gfycat.com')) return this.gfycat(url)
    if (hostname === 'konachan.com') return this.direct(url)

    throw new Error(`unsupported URL ${hostname} ${url}`)
  }
}

export const downloader = new Downloader()
