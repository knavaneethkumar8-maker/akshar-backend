const s3 = require('../middleware/createS3Client');
const {PutObjectCommand} = require('@aws-sdk/client-s3');

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

      res.json({
        message: "Uploaded to S3",
        s3Key: key
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Upload failed" });
    }
  }


  module.exports = {handleVideoUpload};