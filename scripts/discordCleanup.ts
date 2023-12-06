import Discord from 'discord.js'
import { config } from '../modules/config'
import stored from '@undefined/saved'
import pLimit from 'p-limit'

const discord = new Discord.Client({
  intents: ['GuildMessages'],
})

function getAllMessages (channel: Discord.TextChannel) {
  return new Promise<Discord.Collection<string, Discord.Message>>((resolve, reject) => {
    let messages = new Discord.Collection<string, Discord.Message>()
    const fetch = async (before?: string) => {
      const fetched = await channel.messages.fetch({ limit: 100, before })
      messages = messages.concat(fetched)
      console.log(`collected ${messages.size} messages`)
      if (fetched.size < 100) {
        resolve(messages)
      } else {
        fetch(fetched.last()?.id)
      }
    }
    fetch()
  })
}

discord.login(config.DISCORD_TOKEN).then(async () => {
  const channel = await discord.channels.fetch('1118929807057616937')
  if (!channel?.isTextBased) throw new Error('channel is not text based')
  if (!(channel instanceof Discord.TextChannel)) throw new Error('channel is not text channel')

  // get all messages in channel
  const messages = await getAllMessages(channel)
  console.log(`got ${messages.size} messages`)

  // get all stored msgIds
  const storedIds = stored.map(s => s.msgId).flat()

  // get all messages that are not in stored
  const toDelete = messages.filter(m => !storedIds.includes(m.id))
  console.log(`found ${toDelete.size} messages to delete`)

  const limit = pLimit(5)
  // delete all messages
  await Promise.all(toDelete.map(m => limit(async () => {
    await m.delete()
    console.log(`deleted message ${m.id}`)
  })))

  discord.destroy()
})
