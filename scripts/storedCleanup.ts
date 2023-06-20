import { writeFileSync } from 'fs'
import stored from '../stored.json'

// find dubplicates
const duplicates = stored.filter((item, index, self) => self.findIndex(i => i.name === item.name) !== index)
console.log('found', duplicates.length, 'duplicates')
// remove duplicates
const filtered = stored.filter(item => !duplicates.includes(item))
writeFileSync('./stored.json', JSON.stringify(filtered, null, 2))

// find items with emtpy cdnUrl
const emptyCdnUrl = stored.filter(item => item.cdnUrl.length === 0)
console.log('found', emptyCdnUrl.length, 'items with empty cdnUrl')
// remove items with empty cdnUrl
const filtered2 = filtered.filter(item => !emptyCdnUrl.includes(item))
writeFileSync('./stored.json', JSON.stringify(filtered2, null, 2))
