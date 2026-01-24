const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");

const uploadRoot = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const user = req.params.user;
    const tempDir = path.join(uploadRoot, user, "recordings", "tmp");

    await fs.ensureDir(tempDir);
    cb(null, tempDir);
  },

  filename: (req, file, cb) => {
    // keep original extension (mp4 / webm / etc)
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}_${Date.now()}${ext}`);
  }
});

const store = multer({ storage });

module.exports = store;
