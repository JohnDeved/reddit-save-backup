import Discord from 'discord.js'
import { config } from '../modules/config'

const discord = new Discord.Client({
  intents: ['GuildMessages'],
})

discord.login(config.DISCORD_TOKEN).then(async () => {
  const channel = await discord.channels.fetch('1118929807057616937')
  if (!channel?.isTextBased()) throw new Error('channel is not text based')
  // get all messages in channel
  const messages = await channel.messages.fetch()
  console.log(`got ${messages.size} messages`)
})
