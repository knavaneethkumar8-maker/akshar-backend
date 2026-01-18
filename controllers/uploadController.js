const s3 = require('../middleware/createS3Client');
const {PutObjectCommand} = require('@aws-sdk/client-s3');
const extractAudioWav = require('../middleware/extractAudio');

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
        Body: req.file.buffer,        // 👈 video bytes
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
module.exports = {handleVideoUpload, handleAudioUpload};