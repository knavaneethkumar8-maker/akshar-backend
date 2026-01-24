const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs-extra");
const store = require("../middleware/storage.js");

const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");

ffmpeg.setFfmpegPath(ffmpegPath);

router.post(
  "/:user/recordings/:filename",
  store.single("file"),
  async (req, res) => {
    try {
      const { user, filename } = req.params;
      const metadata = JSON.parse(req.body.metadata);

      const inputPath = req.file.path;

      const recordingsDir = path.join(
        __dirname,
        "..",
        "uploads",
        user,
        "recordings"
      );

      const outputPath = path.join(
        recordingsDir,
        filename.replace(/\.\w+$/, ".wav")
      );

      await fs.ensureDir(recordingsDir);

      // 🔁 CONVERT → WAV
      ffmpeg(inputPath)
        .toFormat("wav")
        .audioCodec("pcm_s16le")
        .on("end", async () => {
          // remove temp file
          await fs.remove(inputPath);

          // save metadata
          const metaFile = path.join(recordingsDir, "metadata.json");
          let existing = [];

          if (await fs.pathExists(metaFile)) {
            existing = await fs.readJson(metaFile);
          }

          existing.push({
            ...metadata,
            filename: path.basename(outputPath)
          });

          await fs.writeJson(metaFile, existing, { spaces: 2 });

          res.json({ message: "Saved successfully" });
        })
        .on("error", async err => {
          console.error("FFMPEG ERROR:", err);
          await fs.remove(inputPath);
          res.status(500).json({ message: "Audio conversion failed" });
        })
        .save(outputPath);

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Storage failed" });
    }
  }
);

module.exports = router;
