const multer = require('multer');

const storage = multer.diskStorage({
  destination : (req, file, cb) => {
    if(file.fieldname === "video") {
      cb(null, 'uploads/video/');
    } else {
      cb(null, "uploads/audio/")
    }
  },
  filename : (req, file, cb) => {
    cb(null, req.params.fileName);
  }
});


const upload = multer({storage});

module.exports = upload;