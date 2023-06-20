import { load as loadHtml } from 'cheerio'
import { fetch } from 'undici'

const directExt = ['jpg', 'jpeg', 'png', 'gif', 'mp4']

class Downloader {
  direct (url: string) {
    const regex = /\.(\w{3,4})(\?.*)?$/
    const ext = url.match(regex)?.[1]
    if (!ext) throw new Error(`direct unexpected URL ${url}`)
    if (!directExt.includes(ext)) throw new Error(`direct unsupported extension ${ext}`)

    return fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`direct unexpected BODY (removed) ${url} ${response.status}`)
        if (response.url.includes('removed')) throw new Error(`direct removed ${url}`)
        return response.body
      })
      .then(stream => ({ stream, ext }))
  }

  ogMeta (url: string) {
    return fetch(url)
      .then(response => {
        if ([404, 410].includes(response.status)) throw new Error(`ogMeta bad status (removed) ${url} ${response.status}`)
        if (!response.ok) throw new Error(`ogMeta unexpected status ${url} ${response.status}`)
        return response.text()
      })
      .then(html => {
        const $ = loadHtml(html)
        // get og:video or og:image
        const videoUrl = $('meta[property="og:video"]').attr('content')
        if (videoUrl) return videoUrl
        const imageUrl = $('meta[property="og:image"]').attr('content')
        if (imageUrl) return imageUrl

        throw new Error(`og:video or og:image not found (removed) ${url}`)
      })
      .then(url => {
        // strip everything after ?
        const regex = /^(.*?)(\?.*)?$/
        const match = url.match(regex)?.[1]
        if (!match) throw new Error(`og:video or og:image unexpected URL ${url}`)
        return match
      })
      .then(this.direct)
  }

  async download (url: string) {
    if (!url.startsWith('http')) throw new Error(`download unexpected URL (removed) ${url}`)
    const { pathname } = new URL(url)
    if (directExt.some(ext => pathname.endsWith(`.${ext}`))) return this.direct(url)
    return this.ogMeta(url)
  }
}

export const downloader = new Downloader()
