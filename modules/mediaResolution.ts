import Ffmpeg from '../modules/ffmpeg'

export function getMediaResolution (filePath: string): Promise<{ width: number, height: number }> {
  const ffmpeg = Ffmpeg()
  return new Promise((resolve, reject) => ffmpeg.input(filePath).ffprobe((err, data) => {
    ffmpeg.kill('SIGKILL')
    if (err) return reject(err)

    // get first stream with resolution
    const stream = data.streams.find(s => s.width && s.height)
    if (!stream) return reject(new Error(`getMediaResolution: no streams ${filePath}`))
    if (!stream.width || !stream.height) return reject(new Error(`getMediaResolution: no resolution ${filePath}`))

    resolve({
      width: stream.width,
      height: stream.height,
    })
  }))
}
