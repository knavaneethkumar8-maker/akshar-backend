const multer = require('multer');
const fs = require('fs');
const fsPromies = require('fs').promises;
const path = require('path');

const storage = multer.diskStorage({
  destination : async (req, file, cb) => {
    try {

      if(file.fieldname === "video") {
        const videoDir = path.join(__dirname, "..", "uploads", "video");
        if(!fs.existsSync(videoDir)) {
          await fsPromies.mkdir(videoDir, {recursive : true});
        }
        cb(null, videoDir);
      } else if(file.fieldname === "audio") {
        const audioDir = path.join(__dirname, "..", "uploads", "audio");
        if(!fs.existsSync(audioDir)) {
          await fsPromies.mkdir(audioDir, {recursive:true});
        }
        cb(null, audioDir);
      } else {
        cb(new Error('Unexpected field name'));
      }
    } catch(err) {
      console.error(err);
    }
  },
  filename : (req, file, cb) => {
    cb(null, req.params.fileName);
  }
});


const diskStore = multer({storage});

module.exports = diskStore;