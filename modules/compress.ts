import Ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'
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

    // bitrate in kb
    const bitrate = Math.floor(20 * 1024 * 8 / duration)
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
        .addOption('-vf', 'scale=min(1280\\, iw):-2')
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

  throw new Error(`unknown file type, cannot convert ${filePath}`)
}
