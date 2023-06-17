import Ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { stat } from 'fs/promises'

if (ffmpegPath) Ffmpeg.setFfmpegPath(ffmpegPath)

async function logDiff (oPath: string, cPath: string) {
  const { size: oSize } = await stat(oPath)
  const { size: cSize } = await stat(cPath)
  const sizeDiff = Math.round((oSize - cSize) / oSize * 100)
  console.log(`compressed new video size: ${cSize} bytes`)
  console.log(`compressed old video size: ${oSize} bytes`)
  console.log(`compressed video size: ${sizeDiff}% smaller than original`)
}

export async function compressMedia (filePath: string) {
  const ffmpeg = Ffmpeg()
    .on('stdout', console.log)
    .on('stderr', console.log)

  if (filePath.endsWith('_cl.mp4')) {
    throw new Error('cannot compress already compressed video')
  }

  if (filePath.endsWith('_c.mp4')) {
    // adjust bitrate according to video duration to reach 25mb file size. also min scale 720p
    const duration = await new Promise<number | undefined>((resolve, reject) => {
      ffmpeg.input(filePath)
        .ffprobe((err, data) => {
          if (err) reject(err)
          else resolve(data.format.duration)
        })
    })

    if (!duration) throw new Error('cannot get video duration')

    const bitrate = Math.round(25 * 1024 * 1024 / duration)
    const outPath = filePath.replace(/_c\.mp4/, '_cl.mp4') // cl = compressed lossy
    return new Promise<string>((resolve, reject) => {
      ffmpeg.input(filePath)
        .on('end', async () => {
          await logDiff(filePath, outPath)
          resolve(outPath)
        })
        .on('error', reject)
        .videoBitrate(bitrate)
        .outputFormat('mp4')
        // min scale 720p
        .videoFilters('scale=\'min(1280,iw)\':-2')
        // why -2 instead of -1?
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
        })
        .on('error', reject)
        .outputFormat('mp4')
        .save(outPath)
    })
  }

  throw new Error('unknown file type, cannot convert')
}
