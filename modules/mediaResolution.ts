import Ffmpeg from '../modules/ffmpeg'

export function getMediaResolution (filePath: string): Promise<{ width: number, height: number }> {
  const ffmpeg = Ffmpeg()
  return new Promise((resolve, reject) => ffmpeg.input(filePath).ffprobe((err, data) => {
    ffmpeg.kill('SIGKILL')
    if (err) return reject(err)
    if (!data.streams[0]) return reject(new Error('getMediaResolution: no streams'))
    if (!data.streams[0].width || !data.streams[0].height) return reject(new Error('getMediaResolution: no resolution'))

    resolve({
      width: data.streams[0].width,
      height: data.streams[0].height,
    })
  }))
}
