const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const {PassThrough} = require('stream');

ffmpeg.setFfmpegPath(ffmpegPath);

function extractAudioWav(videoBuffer) {
  return new Promise((resolve, reject) => {
    const inputStream = new PassThrough();
    const outputStream = new PassThrough();

    inputStream.end(videoBuffer);

    const chunks = [];

    outputStream.on("data", chunk => chunks.push(chunk));
    outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    outputStream.on("error", reject);

    ffmpeg(inputStream)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioChannels(1)
      .audioFrequency(44100)
      .format("wav")
      .on("error", reject)
      .pipe(outputStream);
  });
}

module.exports = extractAudioWav;
