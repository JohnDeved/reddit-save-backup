import oldSaved from '../old.saved.json'
import stored from '@undefined/saved'
import fs from 'fs'

// fetch info for old saves in batches of 100
main()
async function main () {
  const batches = []
  for (let i = 0; i < oldSaved.length; i += 100) {
    batches.push(oldSaved.slice(i, i + 100))
  }

  const results = []
  let fetchCount = 0
  // eslint-disable-next-line no-unreachable-loop
  for (const batch of batches) {
    // must be 100 requests per minute max
    await new Promise(resolve => setTimeout(resolve, 60 * 1000 / 100))

    fetchCount += batch.length
    console.log(`fetching ${fetchCount} of ${oldSaved.length}`)
    const res = await fetch(`https://www.reddit.com/api/info.json?id=${batch.join(',')}`)
      .then(res => res.json())
      .then(res => res.data.children)

    results.push(...res)
  }

  // filter out already saved by title
  const storedTitles = stored.map(s => s.title)
  const unStored = results.filter(r => !storedTitles.includes(r.data.title))
  const unStoredNames = unStored.map(u => u.data.name)
  const alreadyStored = results.filter(r => storedTitles.includes(r.data.title))

  console.log(`found ${unStored.length} new saves`)
  console.log(`found ${alreadyStored.length} already saved`)
  console.log(`found ${results.length} total saves`)

  // write to file
  fs.writeFileSync('./old.saved.json', JSON.stringify(unStoredNames, null, 2))

  // update alreadyStored with new ids and names
  for (const store of alreadyStored) {
    const index = stored.findIndex(s => s.title === store.data.title)
    stored[index].id = store.data.id
    stored[index].name = store.data.name
  }

  fs.writeFileSync('./stored.json', JSON.stringify(stored, null, 2))
}
