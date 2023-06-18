import Ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import ffprobe from 'ffprobe-static'

if (ffmpegPath) Ffmpeg.setFfmpegPath(ffmpegPath)
if (ffprobe.path) Ffmpeg.setFfprobePath(ffprobe.path)

export default Ffmpeg
