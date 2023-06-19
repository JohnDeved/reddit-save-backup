import { writeFileSync } from 'fs'
import stored from '../stored.json'

// find dubplicates
const duplicates = stored.filter((item, index, self) => self.findIndex(i => i.name === item.name) !== index)
console.log('found', duplicates.length, 'duplicates')
// remove duplicates
const filtered = stored.filter(item => !duplicates.includes(item))
writeFileSync('./stored.json', JSON.stringify(filtered, null, 2))
