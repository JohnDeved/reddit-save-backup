# imgur-reddit-backup

- make use of github actions to scedule reddit api calls
  - no hosting required
  - can run as cron job every X minutes
  - github actions limits ([doc](https://docs.github.com/en/actions/reference/usage-limits-billing-and-administration#usage-limits))
  - 3000 minutes (50 hours) per month runtime
- make use of discord, google drive or github to host images
  - github limit 10mb per media file ([doc](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files))
  - discord limit 25mb per file (has added benefit of being able to view images in discord)
  - google drive has download rate limit and some issues with enbedding images
- commit links to a json file rather than a database just so it can easily be served on github (should not be big enough to require a db)
- create static SPA to view images on cloudflare pages (longer lasting alternative to reddit posts)
  - cloudflare pages limits ([doc](https://developers.cloudflare.com/pages/platform/limits))
  - cloudflare pages limit 500 builds per month
  - unlimited bandwidth
  - 25mb per file asset, hosted by cloudflare cdn, 20k files per project (might also be a way to host the images)
