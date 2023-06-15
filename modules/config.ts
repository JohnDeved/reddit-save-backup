import z from 'zod'
import { config as dc } from 'dotenv'
dc()

const ConfigSchema = z.object({
  CLIENT_ID: z.string().nonempty(),
  CLIENT_SECRET: z.string().nonempty(),
  REDDIT_USERNAME: z.string().nonempty(),
  REDDIT_PASSWORD: z.string().nonempty(),
  DISCORD_TOKEN: z.string().nonempty(),
})

export const config = ConfigSchema.parse(process.env)
