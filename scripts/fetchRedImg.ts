import fs from 'fs'
import { pipeline } from 'stream/promises'
import { fetch } from 'undici'

fetch('https://api.redgifs.com/v2/gifs/joyfulbarrenhypacrosaurus/files/JoyfulBarrenHypacrosaurus-large.jpg')
  .then(res => res.body)
  .then(body => {
    if (!body) throw new Error('no body')
    const file = fs.createWriteStream('./test.jpg')
    setTimeout(() => {
      pipeline(body as any, file)
    }, 500)
  })
