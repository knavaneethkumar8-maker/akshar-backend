const s3 = require('../middleware/createS3Client');
const {PutObjectCommand} = require('@aws-sdk/client-s3');
const extractAudioWavFromPath = require('../middleware/extractAudio');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { getAudioDurationInSeconds } = require("get-audio-duration");


const GRID_SIZE_MS = 216;

const TIERS = [
  { key: "akash", name: "आकाश", cells: 1 },
  { key: "agni", name: "अग्नि", cells: 2 },
  { key: "vayu", name: "वायु", cells: 4 },
  { key: "jal", name: "जल", cells: 8 },
  { key: "prithvi", name: "पृथ्वी", cells: 24 }
];


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

    const filePath = req.file.path;
    const fileName = req.file.filename;
    console.log('file present');

    if (!fs.existsSync(filePath)) {
      console.log('eror');
      throw new Error("Audio file missing on disk");
    }

    /*const localRecordingPath = await saveAudioFileToLocal({
      filePath,
      fileName
    }); */


    const durationSeconds = await getAudioDurationInSeconds(filePath);
    const durationMs = Math.round(durationSeconds * 1000);

    console.log(durationMs, durationSeconds)

    await appendRecordingMetadata({
      fileName,
      durationSeconds,
      recorder: "username"
    });

    console.log('metadata wrote');

    const audioS3Key = `audios/${Date.now()}-${req.file.originalname}`;
    console.log(audioS3Key);
    console.log(filePath);

    /* try {
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: audioS3Key,
          Body: fs.createReadStream(filePath),
          ContentType: req.file.mimetype
        })
      );
      console.log('audio sent to s3 ✅');
    } catch (err) {
      console.error('Failed to upload audio to S3:', err);
    } */


    const grids = generateGridsForAudio({ fileName, durationMs });

    const audioMetadata = buildAudioMetadata({
      fileName,
      durationMs,
      s3Key: audioS3Key
    });

    const audioJson = { metadata: audioMetadata, grids };

    const jsonPath = await saveAudioJsonToFile({ audioJson, fileName });
    console.log(jsonPath);

    if (!jsonPath || !fs.existsSync(jsonPath)) {
      throw new Error("JSON file creation failed");
    }

    const baseName = path.parse(fileName).name;
    const jsonS3Key = `audios/${Date.now()}-${baseName}.json`;
    console.log(jsonS3Key + "before");

    const jsonContent = await fs.promises.readFile(jsonPath, "utf8");
    console.log(jsonContent);

    /* const controller = new AbortController();

    setTimeout(() => controller.abort(), 10000);

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: jsonS3Key,
        Body: fs.createReadStream(jsonPath),
        ContentType: "application/json"
      })
    ); */


    console.log('success'); 

    res.status(200).json({
      message: "Upload successful",
      audio: audioS3Key,
      json: jsonS3Key
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return res.status(500).json({
      message: "Upload failed",
      error: err.message
    });
  }
};



const handleTextGridUpload = async (req, res) => {
  try {
    if (!req.params.fileName) {
      return res.status(400).json({ message: "filename missing" });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "body is missing" });
    }

    const baseName = path.parse(req.params.fileName).name;
    const uploadDirPath = path.join(__dirname, "..", "uploads", "textgrids");

    // ensure directory exists
    await fsPromises.mkdir(uploadDirPath, { recursive: true });

    // 🔹 find next version number
    const files = await fsPromises.readdir(uploadDirPath);
    const versionRegex = new RegExp(`^${baseName}(?:_v(\\d+))?\\.json$`);

    let maxVersion = 0;

    for (const file of files) {
      const match = file.match(versionRegex);
      if (match) {
        const version = match[1] ? parseInt(match[1], 10) : 1;
        maxVersion = Math.max(maxVersion, version);
      }
    }

    const nextVersion = maxVersion === 0 ? 1 : maxVersion + 1;

    const finalFileName =
      nextVersion === 1
        ? `${baseName}.json`
        : `${baseName}_v${nextVersion}.json`;

    const filePath = path.join(uploadDirPath, finalFileName);

    await fsPromises.writeFile(
      filePath,
      JSON.stringify(req.body, null, 2),
      "utf8"
    );

    /* --------------------------------------------------
       🔹 UPDATE RECORDING STATUS → FINISHED
    -------------------------------------------------- */
    const metadataPath = path.join(
      __dirname,
      "..",
      "uploads",
      "recordings",
      "metadata.json"
    );

    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(
        await fsPromises.readFile(metadataPath, "utf8")
      );

      const audioFileName = `${baseName}.wav`;

      let updated = false;

      for (const record of metadata) {
        if (record.filename === audioFileName) {
          record.status = "FINISHED";
          updated = true;
          break;
        }
      }

      if (updated) {
        await fsPromises.writeFile(
          metadataPath,
          JSON.stringify(metadata, null, 2),
          "utf8"
        );
      }
    }

    /* -------------------------------------------------- */

    res.status(200).json({
      message: "Textgrid stored successfully",
      file: finalFileName,
      version: nextVersion
    });

  } catch (err) {
    console.error("TEXTGRID UPLOAD ERROR:", err);
    res.status(500).json({ message: "Failed to store textgrid" });
  }
};




const handleGridUpload = async (req, res) => {
  try {
    if (!req.params.gridId) {
      return res.status(400).json({ message: "gridId missing" });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "body is missing" });
    }

    const gridId = req.params.gridId;
    const uploadDirPath = path.join(__dirname, "..", "uploads", "grids");

    // ensure directory exists
    await fsPromises.mkdir(uploadDirPath, { recursive: true });

    // 🔹 detect next version
    const files = await fsPromises.readdir(uploadDirPath);

    const versionRegex = new RegExp(`^${gridId}(?:_v(\\d+))?\\.json$`);

    let maxVersion = 0;

    for (const file of files) {
      const match = file.match(versionRegex);
      if (match) {
        const version = match[1] ? parseInt(match[1], 10) : 1;
        maxVersion = Math.max(maxVersion, version);
      }
    }

    const nextVersion = maxVersion === 0 ? 1 : maxVersion + 1;

    const finalFileName =
      nextVersion === 1
        ? `${gridId}.json`
        : `${gridId}_v${nextVersion}.json`;

    const filePath = path.join(uploadDirPath, finalFileName);

    await fsPromises.writeFile(
      filePath,
      JSON.stringify(req.body, null, 2),
      "utf8"
    );

    res.status(200).json({
      message: "Grid stored successfully",
      file: finalFileName,
      version: nextVersion
    });

  } catch (err) {
    console.error("GRID UPLOAD ERROR:", err);
    res.status(500).json({ message: "Failed to store grid" });
  }
};


const handleCellUpload = async (req, res) => {
  try {
    if (!req.params.cellId) {
      return res.status(400).json({ message: "cellId missing" });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: "body is missing" });
    }

    const cellId = req.params.cellId;
    const uploadDirPath = path.join(__dirname, "..", "uploads", "cells");

    // ensure directory exists
    await fsPromises.mkdir(uploadDirPath, { recursive: true });

    // 🔹 detect next version
    const files = await fsPromises.readdir(uploadDirPath);

    const versionRegex = new RegExp(`^${cellId}(?:_v(\\d+))?\\.json$`);

    let maxVersion = 0;

    for (const file of files) {
      const match = file.match(versionRegex);
      if (match) {
        const version = match[1] ? parseInt(match[1], 10) : 1;
        maxVersion = Math.max(maxVersion, version);
      }
    }

    const nextVersion = maxVersion === 0 ? 1 : maxVersion + 1;

    const finalFileName =
      nextVersion === 1
        ? `${cellId}.json`
        : `${cellId}_v${nextVersion}.json`;

    const filePath = path.join(uploadDirPath, finalFileName);

    await fsPromises.writeFile(
      filePath,
      JSON.stringify(req.body, null, 2),
      "utf8"
    );

    res.status(200).json({
      message: "Cell stored successfully",
      file: finalFileName,
      version: nextVersion
    });

  } catch (err) {
    console.error("CELL UPLOAD ERROR:", err);
    res.status(500).json({ message: "Failed to store cell" });
  }
};



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


function createGrid({ fileName, gridIndex, startMs }) {
  console.log('creating a grid');
  const endMs = startMs + GRID_SIZE_MS;
  let globalCellIndex = 1;

  const tiers = {};

  TIERS.forEach((tier, tierIndex) => {
    const cellDuration = GRID_SIZE_MS / tier.cells;

    const cells = Array.from({ length: tier.cells }).map((_, i) => ({
      id: `${fileName}_${gridIndex}_${globalCellIndex++}`,
      index: i + 1,
      start_ms: Math.round(startMs + i * cellDuration),
      end_ms: Math.round(startMs + (i + 1) * cellDuration),
      text: "",
      conf: 0,
      status: "NEW",
      is_locked: false,
      metadata: {}
    }));

    tiers[tier.key] = {
      name: tier.name,
      index: tierIndex,
      start_ms: startMs,
      end_ms: endMs,
      cells
    };
  });

  return {
    id: `${fileName}_${gridIndex}`,
    index: gridIndex,
    start_ms: startMs,
    end_ms: endMs,
    status: "NEW",
    is_locked: false,
    metadata: {},
    tiers
  };
}


function generateGridsForAudio({ fileName, durationMs }) {
  const totalGrids = Math.ceil(durationMs / GRID_SIZE_MS);
  const grids = [];

  for (let i = 0; i < totalGrids; i++) {
    grids.push(
      createGrid({
        fileName,
        gridIndex: i,
        startMs: i * GRID_SIZE_MS
      })
    );
  }

  return grids;
}

function buildAudioMetadata({ fileName, durationMs, s3Key }) {
  return {
    audio_id: fileName,
    duration_ms: durationMs,
    grid_size_ms: GRID_SIZE_MS,
    total_grids: Math.ceil(durationMs / GRID_SIZE_MS),
    uploaded_at: new Date().toISOString(),
    storage: {
      provider: "s3",
      bucket: process.env.AWS_BUCKET_NAME,
      key: s3Key
    },
    status : "NEW"
  };
}


async function saveAudioJsonToFile({ audioJson, fileName }) {
  const jsonDir = path.join(__dirname,"..", "uploads", "textgrids");
  if (!fs.existsSync(jsonDir)) {
    fs.mkdirSync(jsonDir, { recursive: true });
  }

  const jsonFilePath = path.join(
    jsonDir,
    fileName.replace(".wav", ".json")
  );

  fs.writeFileSync(
    jsonFilePath,
    JSON.stringify(audioJson, null, 2),
    "utf8"
  );

  return jsonFilePath;
}



async function uploadJsonToS3(jsonContent, jsonS3Key) {
  const controller = new AbortController();

    setTimeout(() => controller.abort(), 10000);

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: jsonS3Key,
        Body: jsonContent,
        ContentType: "application/json"
      }),
      { abortSignal: controller.signal }
    );
}


async function saveAudioFileToLocal({ filePath, fileName }) {
  const recordingsDir = path.join(__dirname, "..", "uploads", "recordings");

  // ensure directory exists
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }

  const targetPath = path.join(recordingsDir, fileName);

  // copy audio file to recordings folder
  await fs.promises.copyFile(filePath, targetPath);

  return targetPath;
}


function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

async function appendRecordingMetadata({
  fileName,
  durationSeconds,
  recorder = "username"
}) {
  const recordingsDir = path.join(__dirname, "..", "uploads", "recordings");
  const metadataPath = path.join(recordingsDir, "metadata.json");

  // ensure directory exists
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }

  let recordings = [];

  // read existing metadata.json if present
  if (fs.existsSync(metadataPath)) {
    const raw = await fs.promises.readFile(metadataPath, "utf8");
    recordings = JSON.parse(raw);
  }

  const newRecord = {
    filename: fileName,
    duration: formatDuration(durationSeconds),
    recordedAt: new Date().toLocaleString("en-IN"),
    recorder,
    status: "NEW"
  };

  recordings.unshift(newRecord);
  console.log(newRecord);

  await fs.promises.writeFile(
    metadataPath,
    JSON.stringify(recordings, null, 2),
    "utf8"
  );
}




module.exports = {handleVideoUpload, handleAudioUpload, handleTextGridUpload, handleGridUpload, handleUserTextGridUpload, handleCellUpload};