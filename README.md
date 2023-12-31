# reddit-save-backup

`npm i JohnDeved/reddit-save-backup` to install json

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
  - github oauth login for admin control, to delete & commit entries
  - image zoom https://www.npmjs.com/package/react-medium-image-zoom
  - gallery posts https://www.npmjs.com/package/swiper
  - masonry https://mui.com/material-ui/react-image-list/
  - virtualized list https://mui.com/components/lists/#virtualized-list

todo:
  - convert images to progressive
    - https://www.npmjs.com/package/sharp-cli
    - https://www.npmjs.com/package/sharp
    - https://sharp.pixelplumbing.com/api-output#jpeg
    - npx sharp-cli -i in.jpg -p -q 100 -o out.jpg
