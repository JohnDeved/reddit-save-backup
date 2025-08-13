import ffmpegPath from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'
import Ffmpeg from 'fluent-ffmpeg'
import { existsSync } from 'fs'
import { stat } from 'fs/promises'

if (ffmpegPath) Ffmpeg.setFfmpegPath(ffmpegPath)
if (ffprobe.path) Ffmpeg.setFfprobePath(ffprobe.path)

async function logDiff (oPath: string, cPath: string, bitrate?: number) {
  const { size: oSize } = await stat(oPath)
  const { size: cSize } = await stat(cPath)
  const sizeDiff = Math.round((oSize - cSize) / oSize * 100)
  if (bitrate) console.log(`bitrate: ${bitrate}kb`)
  console.log(`compressed new video size: ${cSize} bytes`)
  console.log(`compressed old video size: ${oSize} bytes`)
  console.log(`compressed video size: ${sizeDiff}% smaller than original`)
}

export async function compressMedia (filePath: string) {
  const ffmpeg = Ffmpeg()
    .on('stdout', console.log)
    .on('stderr', console.log)

  // If file is already compressed to lossy format, return as-is for upload
  if (filePath.includes('_cl.mp4')) {
    console.log(`File already compressed to lossy format, returning for upload: ${filePath}`)
    return filePath
  }

  // check if file already exists in compressed format (only for original files, not _c files)
  if (filePath.endsWith('.mp4') && !filePath.includes('_c.mp4') && existsSync(filePath.replace(/\.mp4/, '_cl.mp4'))) {
    console.log('compressed file already exists')
    return filePath.replace(/\.mp4/, '_cl.mp4')
  }

  if (filePath.endsWith('_c.mp4')) {
    // adjust bitrate according to video duration to reach 10mb file size. also min scale 720p
    const duration = await new Promise<number | undefined>((resolve, reject) => {
      ffmpeg.input(filePath)
        .ffprobe((err, data) => {
          if (err) {
            console.warn(`Failed to probe ${filePath}, file may be corrupted:`, err.message)
            reject(new Error(`Cannot probe video file ${filePath} - file may be corrupted`))
          } else {
            resolve(data.format.duration)
          }
        })
    })

    if (!duration) throw new Error('cannot get video duration')

    // bitrate in kb
    // Target 10MB file size for Discord
    const bitrate = Math.floor(10 * 1024 * 8 / duration)
    const outPath = filePath.replace(/_c\.mp4/, '_cl.mp4') // cl = compressed lossy
    return new Promise<string>((resolve, reject) => {
      ffmpeg.input(filePath)
        .on('end', async () => {
          await logDiff(filePath, outPath, bitrate)
          resolve(outPath)
          ffmpeg.kill('SIGKILL')
        })
        .on('error', reject)
        .outputFormat('mp4')
        // max bitrate
        .addOption('-maxrate', `${bitrate}k`)
        .addOption('-bufsize', `${bitrate * 2}k`)
        // min scale 720p
        .addOption('-vf', "scale='if(gt(iw,ih),1280,-2):if(gt(iw,ih),-2,1280)")
        .save(outPath)
    })
  }

  if (filePath.endsWith('.gif') || filePath.endsWith('.mp4')) {
    // gif to mp4
    return new Promise<string>((resolve, reject) => {
      const outPath = filePath.replace(/\.gif|\.mp4/, '_c.mp4') // c = compressed
      ffmpeg.input(filePath)
        .on('end', async () => {
          await logDiff(filePath, outPath)
          resolve(outPath)
          ffmpeg.kill('SIGKILL')
        })
        .on('error', reject)
        .outputFormat('mp4')
        .save(outPath)
    })
  }

  // check if is image
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg') || filePath.endsWith('.png')) {
    // image downscale to 1080p
    return new Promise<string>((resolve, reject) => {
      const outPath = filePath.replace(/\.(jpg|jpeg|png)/, '_c.jpg') // c = compressed
      ffmpeg.input(filePath)
        .on('end', async () => {
          await logDiff(filePath, outPath)
          resolve(outPath)
          ffmpeg.kill('SIGKILL')
        })
        .on('error', reject)
        .outputFormat('mjpeg')
        // min scale 1080p
        .addOption('-vf', "scale='if(gt(iw,ih),1920,-1):if(gt(iw,ih),-1,1920)")
        .addOption('-q', '1')
        .save(outPath)
    })
  }

  throw new Error(`unknown file type, cannot convert ${filePath}`)
}
