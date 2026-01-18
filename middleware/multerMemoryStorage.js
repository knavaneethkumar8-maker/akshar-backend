const multer = require('multer');

const storeFile = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1000 * 1024 * 1024 // 1GB (adjust)
  }
});

module.exports = storeFile;
