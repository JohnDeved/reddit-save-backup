import { Headers, FormData, fetch } from 'undici'
import z from 'zod'
import { inspect } from 'util'

// Add timeout and retry configuration for Reddit API
const FETCH_TIMEOUT = 60000 // 60 seconds (increased from 30)
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
      console.warn(`Reddit API attempt ${attempt}/${MAX_RETRIES} failed for ${url}:`, error)

      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 2s, 4s, 6s
        const delay = RETRY_DELAY * attempt
        console.log(`⏳ Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${MAX_RETRIES} attempts`)
}

export class Reddit {
  constructor (
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly username: string,
    private readonly password: string,
  ) {}

  private _token: z.infer<typeof this._redditTokenSchema> | null = null
  private _tokenExpiresAt: number | null = null

  private readonly _redditTokenSchema = z.object({
    access_token: z.string(),
    token_type: z.string(),
    expires_in: z.number(),
    scope: z.string(),
  })

  async getToken () {
    if (this._token) {
      if (this._tokenExpiresAt && this._tokenExpiresAt > Date.now()) {
        return this._token
      }
    }

    const myHeaders = new Headers()
    myHeaders.append('Authorization', `Basic ${btoa(`${this.clientId}:${this.clientSecret}`)}`)

    const formdata = new FormData()
    formdata.append('grant_type', 'password')
    formdata.append('username', this.username)
    formdata.append('password', this.password)

    const token = await fetchWithRetry('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: myHeaders,
      body: formdata,
    })
      .then(response => response.json())
      .then(data => this._redditTokenSchema.parse(data))

    this._token = token
    this._tokenExpiresAt = Date.now() + token.expires_in * 1000

    return token
  }

  async getAuthHeader () {
    const token = await this.getToken()
    const headers = new Headers()
    headers.append('Authorization', `${token.token_type} ${token.access_token}`)
    return headers
  }

  async fetch (path: string, method: 'GET' | 'POST' = 'GET', body?: FormData | URLSearchParams) {
    const headers = await this.getAuthHeader()

    console.log(method, path)
    const data = await fetchWithRetry(`https://oauth.reddit.com${path}`, { method, headers, body })
      .then(response => response.json())

    console.log(method, path, 'response', inspect(data, { colors: true, depth: null }))
    return data
  }

  async get (path: string) {
    return this.fetch(path)
  }

  async post (path: string, body: FormData | URLSearchParams) {
    return this.fetch(path, 'POST', body)
  }

  private readonly _listingOptSchema = z.object({
    before: z.string().optional(),
    after: z.string().optional(),
    count: z.number().optional(),
    limit: z.number().optional(),
    show: z.string().optional(),
  })

  private readonly _getUserSavedSchema = this._listingOptSchema.extend({
    username: z.string().optional(),
  })

  private readonly _listingSchema = z.object({
    kind: z.literal('Listing'),
    data: z.object({
      after: z.string().nullable(),
      before: z.string().nullable(),
      modhash: z.string().nullable(),
      children: z.array(z.object({
        kind: z.literal('t3'),
        data: z.object({
          id: z.string(),
          created: z.number(),
          title: z.string(),
          name: z.string(),
          permalink: z.string(),
          url: z.string(),
          media_metadata: z.record(z.string(), z.object({
            m: z.string(),
          })).nullable().optional(),
          gallery_data: z.object({
            items: z.array(z.object({
              media_id: z.string(),
            })),
          }).nullable().optional(),
          domain: z.string(),
        }),
      })),
    }),
  })

  /**
   * Get a list of posts that the user has saved.
   * https://www.reddit.com/dev/api/#GET_user_{username}_saved
   */
  async getUserSaved (options: z.infer<typeof this._getUserSavedSchema> = {}) {
    const { username = this.username, ...opt } = this._getUserSavedSchema.parse(options)

    const response = await this.get(`/user/${username}/saved?${new URLSearchParams(opt as string).toString()}`)
    return this._listingSchema.parse(response).data
  }

  async getPostInfos (names: string[]) {
    const response = await this.get(`/api/info?id=${names.join(',')}`)
    return this._listingSchema.parse(response).data
  }

  async setUserUnsaved (name: string) {
    const formData = new URLSearchParams()
    formData.append('id', name)
    return this.post('/api/unsave', formData)
  }
}
