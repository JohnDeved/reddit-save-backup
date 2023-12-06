import { writeFileSync } from 'fs'
import stored from '@undefined/saved'

fetch('https://raw.githubusercontent.com/JohnDeved/reddit-save-backup/de5edba5aaa5b9b886425127ce0d3e07c8fd70cb/old.saved.json')
  .then(res => res.json())
  .then(async (names: string[]) => {
    // filter out already saved
    const storedNames = stored.map(s => s.name)
    const unStoredNames = names.filter(n => !storedNames.includes(n))
    writeFileSync('./old.saved.json', JSON.stringify(unStoredNames, null, 2))
  })
