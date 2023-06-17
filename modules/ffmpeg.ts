import Ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'

if (ffmpegPath) Ffmpeg.setFfmpegPath(ffmpegPath)

export async function compressMedia (filePath: string) {
  const ffmpeg = Ffmpeg()
    .on('stdout', console.log)
    .on('stderr', console.log)

  if (filePath.endsWith('_c.mp4')) {
    throw new Error('already converted')
  }

  if (filePath.endsWith('.gif') || filePath.endsWith('.mp4')) {
    // gif to mp4
    return new Promise<string>((resolve, reject) => {
      const outPath = filePath.replace(/\.gif|\.mp4/, '_c.mp4')
      ffmpeg.input(filePath)
        .on('end', () => resolve(outPath))
        .on('error', reject)
        .outputFormat('mp4')
        .save(outPath)
    })
  }

  throw new Error('unknown file type, cannot convert')
}
