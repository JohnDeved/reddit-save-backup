import { load as loadHtml } from 'cheerio'
import { fetch } from 'undici'

const directExt = ['jpg', 'jpeg', 'png', 'gif', 'mp4']

// Add timeout and retry configuration
const FETCH_TIMEOUT = 30000 // 30 seconds
const MAX_RETRIES = 3
const RETRY_DELAY = 2000 // 2 seconds

async function fetchWithTimeout (url: string, options: Record<string, any> = {}) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => { controller.abort() }, FETCH_TIMEOUT)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchWithRetry (url: string, options: Record<string, any> = {}) {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchWithTimeout(url, options)
    } catch (error) {
      lastError = error as Error
      console.warn(`Fetch attempt ${attempt}/${MAX_RETRIES} failed for ${url}:`, error)

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt))
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`)
}

class Downloader {
  direct (url: string) {
    const regex = /\.(\w{3,4})(\?.*)?$/
    const ext = url.match(regex)?.[1]
    if (!ext) throw new Error(`direct unexpected URL ${url}`)
    if (!directExt.includes(ext)) throw new Error(`direct unsupported extension ${ext}`)

    return fetchWithRetry(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0' } })
      .then(response => {
        if (!response.ok) throw new Error(`direct unexpected BODY (removed) ${url} ${response.status}`)
        if (response.url.includes('removed')) throw new Error(`direct removed ${url}`)
        const contentType = response.headers.get('content-type')
        if (!contentType?.includes('image') && !contentType?.includes('video')) throw new Error(`direct unexpected content-type ${contentType ?? ''} ${url}`)

        return response.body
      })
      .then(stream => ({ stream, ext }))
  }

  async redgifsDirect (url: string) {
    const response = await fetchWithRetry('https://api.redgifs.com/v2/auth/temporary', {
      headers: {
        origin: 'https://www.redgifs.com',
        referer: 'https://www.redgifs.com/',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch Redgifs token')
    }

    const data = await response.json() as { token: string }
    const token = data.token

    const regex = /\.(\w{3,4})(\?.*)?$/
    const ext = url.match(regex)?.[1]
    if (!ext) throw new Error(`direct unexpected URL ${url}`)
    if (!directExt.includes(ext)) throw new Error(`direct unsupported extension ${ext}`)

    const videoUrl = await fetchWithRetry(url.split('/files/')[0], {
      headers: {
        authorization: `Bearer ${token}`,
      },
    }).then(res => res.json() as Promise<{ gif: { urls: { hd: string } } }>).then<string>(res => res.gif.urls.hd)

    return fetchWithRetry(videoUrl)
      .then(response => {
        if (!response.ok) throw new Error(`direct unexpected BODY (removed) ${url} ${response.status}`)
        if (response.url.includes('removed')) throw new Error(`direct removed ${url}`)
        const contentType = response.headers.get('content-type')
        if (!contentType?.includes('image') && !contentType?.includes('video')) throw new Error(`direct unexpected content-type ${contentType ?? ''} ${url}`)

        return response.body
      })
      .then(stream => ({ stream, ext }))
  }

  ogMeta (url: string) {
    return fetchWithRetry(url, { headers: { 'user-agent': 'Mozilla/5.0' } })
      .then(response => {
        console.log('ogMeta', url, response.status)
        if ([404, 410].includes(response.status)) throw new Error(`ogMeta bad status (removed) ${url} ${response.status}`)
        if ([403, 429].includes(response.status)) throw new Error(`ogMeta access forbidden ${url} ${response.status}`)
        if (!response.ok) throw new Error(`ogMeta unexpected status ${url} ${response.status}`)
        return response.text()
      })
      .then(html => {
        const $ = loadHtml(html)
        // get og:video or og:image
        const videoUrl = $('meta[property="og:video"]').attr('content') ?? $('meta[property="og:video:url"]').attr('content')
        if (videoUrl) return videoUrl
        const imageUrl = $('meta[property="og:image"]').attr('content') ?? $('meta[property="og:image:url"]').attr('content')
        if (imageUrl) return imageUrl

        throw new Error(`og:video or og:image not found (removed) ${url}`)
      })
      .then(url => {
        console.log('ogMeta url', url)
        // strip everything after ?
        const regex = /^(.*?)(\?.*)?$/
        const match = url.match(regex)?.[1]
        if (!match) throw new Error(`og:video or og:image unexpected URL ${url}`)
        return match
      })
      .then(url => {
        // not needed anymore?
        // if (url.includes('redgifs.com')) {
        //   return this.redgifsDirect(url)
        // }
        return this.direct(url)
      })
  }

  async download (url: string) {
    if (!url.startsWith('http')) throw new Error(`download unexpected URL (removed) ${url}`)
    
    // Block unsupported domains that are known to cause issues
    const blockedDomains = ['pornhub.com', 'xvideos.com', 'xnxx.com']
    const { hostname } = new URL(url)
    
    if (blockedDomains.some(domain => hostname.includes(domain))) {
      throw new Error(`download blocked domain ${hostname} - unsupported site`)
    }
    
    const { pathname } = new URL(url)

    if (directExt.some(ext => pathname.endsWith(`.${ext}`))) {
      // check if content-type

      const { headers } = await fetchWithRetry(url, { method: 'HEAD' })
      const contentType = headers.get('content-type')

      if (contentType?.includes('image') ?? contentType?.includes('video')) {
        if (url.includes('redgifs.com')) {
          return this.redgifsDirect(url)
        }
        return this.direct(url)
      }
    }
    return this.ogMeta(url)
  }
}

export const downloader = new Downloader()
