const s3 = require('../middleware/createS3Client');
const {PutObjectCommand} = require('@aws-sdk/client-s3');
const extractAudioWavFromPath = require('../middleware/extractAudio');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

const handleVideoUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const localVideoPath = req.file.path;
    const s3Key = `videos/${path.basename(localVideoPath)}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
        Body: fs.createReadStream(localVideoPath),
        ContentType: req.file.mimetype
      })
    );

    const wavBuffer = await extractAudioWavFromPath(localVideoPath);

    res.set({
      "Content-Type": "audio/wav",
      "Content-Disposition": "attachment; filename=audio.wav"
    });

    res.send(wavBuffer);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
};


const handleAudioUpload = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const filePath = req.file.path;      // disk file
    const fileStream = fs.createReadStream(filePath);

    const s3Key = `audios/${Date.now()}-${req.file.originalname}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
        Body: fileStream,
        ContentType: req.file.mimetype,
      })
    );

    return res.status(200).json({
      message: "File stored on disk and uploaded to S3",
      localPath: filePath,
      s3Key,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
};


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
const handleGridUpload = async (req, res) => {
  try {
    if(!req.params.gridId) {
      return res.status(400).json({"message" : "gridId missing"});
    }
    if(!req.body) {
      return res.status(400).json({"message" : "body is missing"});
    }
    const gridId = req.params.gridId;
    const fileName = gridId + ".json";
    const jsonGridData = JSON.stringify(req.body, null, 2);
    const uploadDirPath = path.join(__dirname, "..", "uploads", "grids");

    if(!fs.existsSync(uploadDirPath)) {
      await fsPromises.mkdir(uploadDirPath,{recursive : true});
    }
    await fsPromises.writeFile( path.join(uploadDirPath, fileName), jsonGridData, "utf8");
    res.status(200).json({"message" : `successfully stored the grid ${fileName}`});
  } catch (err) {
    console.error(err);
  }
}

const handleUserTextGridUpload = async (req, res) => {
  try {
    const { fileName } = req.params;
    const username = req.params.username;

    if (!username) {
      return res.status(401).json({ message: "unauthorized" });
    }

    if (!fileName) {
      return res.status(400).json({ message: "filename missing" });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "body is missing" });
    }

    const cleanFileName = path.parse(fileName).name + ".json";

    const uploadDirPath = path.join(
      __dirname,
      "..",
      "uploads",
      username,
      "textgrids"
    );

    // ensure directory exists
    await fsPromises.mkdir(uploadDirPath, { recursive: true });

    const filePath = path.join(uploadDirPath, cleanFileName);
    await fsPromises.writeFile(
      filePath,
      JSON.stringify(req.body, null, 2),
      "utf8"
    );

    console.log(req.body.metadata.file_name);
    markRecordingAsFinished(username ,fileName);

    res.status(200).json({
      message: "Textgrid stored successfully",
      path: `${username}/textgrids/${cleanFileName}`
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to store textgrid" });
  }
};



//Helpers

function markRecordingAsFinished(username, targetFilename) {
  const recordingsDir = path.join(process.cwd(), "uploads",`${username}`,  "recordings");
  const filePath = path.join(recordingsDir, "metadata.json");
  console.log(filePath);
  const recordings = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  console.log(recordings);

  const record = recordings.find(r => r.filename === targetFilename);
  if (!record) {
    console.log("Recording not found");
    return;
  }

  record.status = "FINISHED";

  fs.writeFileSync(filePath, JSON.stringify(recordings, null, 2));
}



module.exports = {handleVideoUpload, handleAudioUpload, handleTextGridUpload, handleGridUpload, handleUserTextGridUpload};