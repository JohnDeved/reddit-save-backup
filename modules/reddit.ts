import { Headers, FormData, fetch } from 'undici'
import z from 'zod'

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

    const token = await fetch('https://www.reddit.com/api/v1/access_token', {
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

  /**
   * Make a GET request to the Reddit API.
   * https://www.reddit.com/dev/api/#GET_api_v1_me
   */
  async get (path: string) {
    const token = await this.getToken()

    const myHeaders = new Headers()
    myHeaders.append('Authorization', `${token.token_type} ${token.access_token}`)

    console.log('GET', path)
    return fetch(`https://oauth.reddit.com${path}`, {
      method: 'GET',
      headers: myHeaders,
    })
      .then(response => response.json())
      .then(data => {
        console.log('GET', path, 'response', data)
        return data
      })
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

  /**
   * Get a list of posts that the user has saved.
   * https://www.reddit.com/dev/api/#GET_user_{username}_saved
   */
  async getUserSaved (options: z.infer<typeof this._getUserSavedSchema> = {}) {
    const { username = this.username, ...opt } = this._getUserSavedSchema.parse(options)

    const data = await this.get(`/user/${username}/saved?${new URLSearchParams(opt as any).toString()}`)
    return z.object({
      kind: z.literal('Listing'),
      data: z.object({
        after: z.string().nullable(),
        before: z.string().nullable(),
        modhash: z.string().nullable(),
        children: z.array(z.object({
          kind: z.literal('t3'),
          data: z.object({
            title: z.string(),
            name: z.string(),
            permalink: z.string(),
            url: z.string(),
            url_overridden_by_dest: z.string().nullable(),
            domain: z.string(),
          }),
        })),
      }),
    }).parse(data)
  }
}
