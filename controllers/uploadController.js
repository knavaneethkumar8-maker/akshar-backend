const s3 = require('../middleware/createS3Client');
const {PutObjectCommand} = require('@aws-sdk/client-s3');
const extractAudioWav = require('../middleware/extractAudio');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

const handleVideoUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const fileName = req.params.fileName;
    const key = `videos/${Date.now()}-${fileName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,        //  video bytes
        ContentType: req.file.mimetype
      })
    );

    const wavBuffer = await extractAudioWav(req.file.buffer);

    res.set({
      "Content-Type" : "audio/wav",
      "Content-Disposition": "attachment"
    });

    res.send(wavBuffer);
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
}

const handleAudioUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const fileName = req.params.fileName;
    const key = `audios/${Date.now()}-${fileName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: key,
        Body: req.file.buffer,        // 👈 video bytes
        ContentType: req.file.mimetype
      })
    );

    res.status(200).json({"message" : "successfully uploaded the audio"});
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
}

const handleTextGridUpload = async (req, res) => {
  try {
    if(!req.params.fileName) {
      return res.status(400).json({"message" : "filename missing"});
    }
    if(!req.body) {
      return res.status(400).json({"message" : "body is missing"});
    }
    console.log(req.headers);
    const fileName = path.parse(req.params.fileName).name + ".json";
    const jsonGridData = JSON.stringify(req.body, null, 2);
    const uploadDirPath = path.join(__dirname, "..", "uploads", "textgrids");

    if(!fs.existsSync(uploadDirPath)) {
      await fsPromises.mkdir(uploadDirPath,{recursive : true});
    }
    await fsPromises.writeFile( path.join(uploadDirPath, fileName), jsonGridData, "utf8");
    res.status(200).json({"message" : `successfully stored the textgrid ${fileName}`});
  } catch (err) {
    console.error(err);
  }
}

module.exports = {handleVideoUpload, handleAudioUpload, handleTextGridUpload};