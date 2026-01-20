const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs-extra');
const path = require('path');


ffmpeg.setFfmpegPath(ffmpegPath);

const extractAudioWavFromPath = async (videoPath) => {
  const tempDir = path.join(process.cwd(), "temp");
  await fs.ensureDir(tempDir);

  const outputPath = path.join(
    tempDir,
    `audio-${Date.now()}.wav`
  );

  await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .format("wav")
      .save(outputPath)
      .on("end", resolve)
      .on("error", reject);
  });

  const wavBuffer = await fs.readFile(outputPath);
  await fs.remove(outputPath);

  return wavBuffer;
};

module.exports = extractAudioWavFromPath;
