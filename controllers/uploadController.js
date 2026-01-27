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

    // 🔹 Get duration (backend only)
    const durationSeconds = await getAudioDurationInSeconds(filePath);
    const durationMs = Math.round(durationSeconds * 1000);

    // 🔹 Upload audio to S3
    const s3Key = `audios/${Date.now()}-${req.file.originalname}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
        Body: fs.createReadStream(filePath),
        ContentType: req.file.mimetype
      })
    );

    // 🔹 Generate grids JSON
    const grids = generateGridsForAudio({
      fileName,
      durationMs
    });

    const audioMetadata = buildAudioMetadata({
      fileName,
      durationMs,
      s3Key
    });

    res.status(200).json({
      message: "Audio uploaded, grids generated",
      audio: audioMetadata,
      grids
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
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


function createGrid({ fileName, gridIndex, startMs }) {
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
    }
  };
}

const text = 'इन तरीकों से आप हिंदी वाक्यों को आसानी से कॉपी-पेस्ट कर सकते हैं।';

function distributeTextToCells(text, grids) {
  const allCells = [];

  // Flatten all cells across all tiers
  grids.forEach(grid => {
    Object.values(grid.tiers).forEach(tier => {
      tier.cells.forEach(cell => {
        allCells.push(cell);
      });
    });
  });

  const totalCells = allCells.length;
  const charsPerCell = Math.ceil(text.length / totalCells);

  let charIndex = 0;
  allCells.forEach(cell => {
    const slice = text.slice(charIndex, charIndex + charsPerCell);
    cell.text = slice || "";
    charIndex += charsPerCell;
  });

  return grids;
}








module.exports = {handleVideoUpload, handleAudioUpload, handleTextGridUpload, handleGridUpload, handleUserTextGridUpload};