import { config } from './modules/config'
import { Reddit } from './modules/reddit'
import { inspect } from 'util'

const reddit = new Reddit(config.CLIENT_ID, config.CLIENT_SECRET, config.REDDIT_USERNAME, config.REDDIT_PASSWORD)

// get saved posts
reddit.getUserSaved({ limit: 100 }).then(data => console.log(inspect(data, false, null, true)))
