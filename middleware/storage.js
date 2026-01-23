const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');

const uploadRoot = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const user = req.params.user;
    const userRecDir = path.join(uploadRoot, user, "recordings");

    await fs.ensureDir(userRecDir);
    cb(null, userRecDir);
  },

  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});


const store = multer({storage});

module.exports = store;
