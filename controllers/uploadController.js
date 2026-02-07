const s3 = require('../middleware/createS3Client');
const {PutObjectCommand} = require('@aws-sdk/client-s3');
const extractAudioWavFromPath = require('../middleware/extractAudio');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const { getAudioDurationInSeconds } = require("get-audio-duration");
const { execFile } = require("child_process");
const util = require("util");
const execFileAsync = util.promisify(execFile);
const paths = require('../config/serverPaths');
const axios = require("axios");
const FormData = require("form-data");
const {jsonToTextGrid} = require('../middleware/jsonToTextGrid');
const {wav2tgOrigin} = require("../config/paths");





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

    /* ---------------- PATHS ---------------- */
    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const recordingsDir = path.join(uploadsRoot, "recordings");
    fs.mkdirSync(recordingsDir, { recursive: true });

    const uploadedPath = req.file.path;
    const originalName = req.file.originalname;
    const baseName = path.parse(originalName).name;
    const username = req.body.username;
    console.log("USERNAME",username);
  

    const tempWavPath = path.join(recordingsDir, `${baseName}_tmp.wav`);
    const finalWavPath = path.join(recordingsDir, `${baseName}.wav`);
    const slowed8xPath = path.join(recordingsDir, `${baseName}_8x.wav`);
    const slowed16xPath = path.join(recordingsDir, `${baseName}_16x.wav`);


    /* ---------------- 1️⃣ Convert to REAL WAV ---------------- */
    await execFileAsync(paths.ffmpegPath , [
      "-y",
      "-i", uploadedPath,
      "-ac", "1",
      "-ar", "48000",
      "-c:a", "pcm_s16le",
      tempWavPath
    ]);

    fs.renameSync(tempWavPath, finalWavPath);

    /* ---------------- 2️⃣ Slowed versions (CORRECT) ---------------- */
    await slowAudioSox(finalWavPath, slowed8xPath, 8);
    await slowAudioSox(finalWavPath, slowed16xPath, 16);

    const tgResult = await callWav2TG(finalWavPath, "");
    //console.log("TEXTGRID API RESULT:", tgResult.download_url);

    const tg8x = await callWav2TG(slowed8xPath, "");
    //console.log("TG 8X:", tg8x.download_url);

    const tg16x = await callWav2TG(slowed16xPath, "");
    //console.log("TG 16X:", tg16x.download_url);
    
    const tgPaths = {
      tg : tgResult.download_url,
      tg_8x : tg8x.download_url,
      tg_16x : tg16x.download_url,
    }

    const wavPaths = {
      wav_normal : finalWavPath,
      wav_8x : slowed8xPath,
      wav_16x : slowed16xPath
    }
    
    console.log(tgPaths);

    const runallResult = await callRunAllLocal(
      finalWavPath,
      originalName
    );

    console.log("RUNALL RESULT ↓↓↓");
    //console.log(runallResult.grids);
    //console.log(runallResult);
    const mlGrids = runallResult.grids;

    /* ---------------- 3️⃣ Duration ---------------- */
    const durationSeconds = await getAudioDurationInSeconds(finalWavPath);
    const durationMs = Math.round(durationSeconds * 1000);

    await appendRecordingMetadata({
      fileName: `${baseName}.wav`,
      durationSeconds,
      tgPaths,
      wavPaths,
      recorder: username
    });

    const grids = generateGridsForAudio({
      fileName: `${baseName}.wav`,
      durationMs
    });

    const audioMetadata = buildAudioMetadata({
      fileName: `${baseName}.wav`,
      durationMs,
      s3Key: null, 
      tgPath : tgResult.download_url,
      username
    });

    await saveAudioJsonToFile({
      audioJson: { metadata: audioMetadata, grids : mlGrids},
      fileName: `${baseName}.wav`
    });

    /* ---------------- 4️⃣ Response ---------------- */
    res.status(200).json({
      message: "Upload successful",
      files: {
        original: `/uploads/recordings/${baseName}.wav`,
        slowed_8x: `/uploads/recordings/${baseName}_8x.wav`,
        slowed_16x: `/uploads/recordings/${baseName}_16x.wav`
      },
      duration_ms: durationMs
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

    const uploadJsonDir = path.join(__dirname, "..", "uploads", "textgrids");
    const uploadTGDir = path.join(__dirname, "..", "uploads", "praat");

    await fsPromises.mkdir(uploadJsonDir, { recursive: true });
    await fsPromises.mkdir(uploadTGDir, { recursive: true });

    const files = await fsPromises.readdir(uploadJsonDir);
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

    const finalBase =
      nextVersion === 1 ? baseName : `${baseName}_v${nextVersion}`;

    const jsonFile = `${finalBase}.json`;
    const tgFile = `${finalBase}.TextGrid`;

    const jsonPath = path.join(uploadJsonDir, jsonFile);
    const tgPath = path.join(uploadTGDir, tgFile);

    // 🔹 Save JSON
    await fsPromises.writeFile(
      jsonPath,
      JSON.stringify(req.body, null, 2),
      "utf8"
    );

    // 🔹 Convert JSON → TextGrid
    if (req.body.skipTextGrid !== true) {
      await jsonToTextGrid(jsonPath, tgPath);
    }

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
      message: "Textgrid stored + Praat TextGrid generated",
      json: jsonFile,
      textgrid: tgFile,
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

    if (!req.body || !req.body.id) {
      return res.status(400).json({ message: "invalid grid body" });
    }

    const gridId = req.params.gridId;
    const collectedGrid = req.body;

    /* ===============================
       1. STORE GRID (VERSIONED)
       =============================== */
    const gridDir = path.join(__dirname, "..", "uploads", "grids");
    await fsPromises.mkdir(gridDir, { recursive: true });

    const files = await fsPromises.readdir(gridDir);
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
    const gridFileName =
      nextVersion === 1
        ? `${gridId}.json`
        : `${gridId}_v${nextVersion}.json`;

    await fsPromises.writeFile(
      path.join(gridDir, gridFileName),
      JSON.stringify(collectedGrid, null, 2),
      "utf8"
    );

    /* ===============================
       2. UPDATE GRID IN TEXTGRID
       =============================== */
    const audioMatch = gridId.match(/^(.+?)\.wav_/);
    console.log(audioMatch)
    if (!audioMatch) {
      return res.status(400).json({ message: "Invalid gridId format" });
    }

    const audioId = audioMatch[1];
    const textgridDir = path.join(__dirname, "..", "uploads", "textgrids");

    const textgridFile = await findLatestTextgrid(audioId, textgridDir);
    const textgridPath = path.join(textgridDir, textgridFile);

    const textgrid = JSON.parse(
      await fsPromises.readFile(textgridPath, "utf8")
    );

    const updated = replaceGridInTextgrid(
      textgrid,
      gridId,
      collectedGrid
    );

    if (!updated) {
      return res.status(404).json({ message: "Grid not found in TextGrid" });
    }

    // overwrite same TextGrid file (NO new version)
    const tmpPath = textgridPath + ".tmp";
    await fsPromises.writeFile(tmpPath, JSON.stringify(textgrid, null, 2));
    await fsPromises.rename(tmpPath, textgridPath);

    res.status(200).json({
      message: "Grid stored and TextGrid updated",
      grid_file: gridFileName,
      grid_version: nextVersion,
      textgrid_file: textgridFile
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

    if (!req.body || !req.body.cell) {
      return res.status(400).json({ message: "invalid body structure" });
    }

    const cellId = req.params.cellId;
    const collectedCell = req.body.cell; // ← your collected cell structure

    /* ===============================
       1. STORE CELL (VERSIONED)
       =============================== */
    const cellDir = path.join(__dirname, "..", "uploads", "cells");
    await fsPromises.mkdir(cellDir, { recursive: true });

    const files = await fsPromises.readdir(cellDir);
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
    const cellFileName =
      nextVersion === 1
        ? `${cellId}.json`
        : `${cellId}_v${nextVersion}.json`;

    await fsPromises.writeFile(
      path.join(cellDir, cellFileName),
      JSON.stringify(req.body, null, 2),
      "utf8"
    );

    /* ===============================
       2. UPDATE LATEST TEXTGRID
       =============================== */
    const audioMatch = cellId.match(/^(.+?)\.wav_/);
    if (!audioMatch) {
      return res.status(400).json({ message: "Invalid cellId format" });
    }

    const audioId = audioMatch[1];
    const textgridDir = path.join(__dirname, "..", "uploads", "textgrids");

    const textgridFile = await findLatestTextgrid(audioId, textgridDir);
    const textgridPath = path.join(textgridDir, textgridFile);

    const textgrid = JSON.parse(
      await fsPromises.readFile(textgridPath, "utf8")
    );

    const updated = updateCellTextAndConf(
      textgrid,
      cellId,
      collectedCell.text
    );

    if (!updated) {
      return res.status(404).json({ message: "Cell not found in TextGrid" });
    }

    // atomic overwrite (NO new version)
    const tmpPath = textgridPath + ".tmp";
    await fsPromises.writeFile(tmpPath, JSON.stringify(textgrid, null, 2));
    await fsPromises.rename(tmpPath, textgridPath);

    /* ===============================
       RESPONSE
       =============================== */
    res.status(200).json({
      message: "Cell stored and TextGrid updated",
      cell_file: cellFileName,
      cell_version: nextVersion,
      textgrid_file: textgridFile
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

async function slowAudioSox(inputPath, outputPath, factor) {
  if (factor === 8) {
    // 8x slower → allowed directly
    await execFileAsync(paths.soxPath, [
      inputPath,
      outputPath,
      "tempo",
      "0.125"
    ]);
    return;
  }

  if (factor === 16) {
    // 16x slower → chained tempo (SoX limit safe)
    await execFileAsync(paths.soxPath , [
      inputPath,
      outputPath,
      "tempo", "0.5",
      "tempo", "0.5",
      "tempo", "0.5",
      "tempo", "0.5"
    ]);
    return;
  }

  throw new Error(`Unsupported slow factor: ${factor}`);
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

function buildAudioMetadata({ fileName, durationMs, s3Key, tgPath, username }) {
  return {
    audio_id: fileName,
    duration_ms: durationMs,
    grid_size_ms: GRID_SIZE_MS,
    total_grids: Math.ceil(durationMs / GRID_SIZE_MS),
    recorded_by : username,
    uploaded_at: new Date().toISOString(),
    storage: {
      provider: "s3",
      bucket: process.env.AWS_BUCKET_NAME,
      key: s3Key
    },
    status : "NEW",
    tgPath
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
  tgPaths,
  wavPaths,
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
    tgPaths,
    wavPaths,
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

async function findLatestTextgrid(audioId, dirPath) {
  const files = await fsPromises.readdir(dirPath);
  const regex = new RegExp(`^${audioId}(?:_v(\\d+))?\\.json$`);

  let latestFile = null;
  let maxVersion = 0;

  for (const file of files) {
    const match = file.match(regex);
    if (!match) continue;

    const version = match[1] ? parseInt(match[1], 10) : 1;
    if (version >= maxVersion) {
      maxVersion = version;
      latestFile = file;
    }
  }

  if (!latestFile) {
    throw new Error("TextGrid not found");
  }

  return latestFile;
}

const convertToWav = async (inputPath, wavPath) => {
  await execFileAsync("/opt/homebrew/bin/ffmpeg", [
    "-y",
    "-i", inputPath,
    "-ac", "1",
    "-ar", "48000",
    wavPath
  ]);
};

function updateCellTextAndConf(textgrid, cellId, newText) {
  for (const grid of textgrid.grids) {
    for (const tier of Object.values(grid.tiers)) {
      if (!Array.isArray(tier.cells)) continue;

      for (const cell of tier.cells) {
        if (cell.id === cellId) {
          cell.text = newText;
          cell.conf = 1;
          cell.status = "EDITED";
          cell.is_locked = false;
          return true;
        }
      }
    }
  }
  return false;
}

function replaceGridInTextgrid(textgrid, gridId, newGrid) {
  for (let i = 0; i < textgrid.grids.length; i++) {
    if (textgrid.grids[i].id === gridId) {
      textgrid.grids[i] = {
        ...textgrid.grids[i], // keeps position in array
        ...newGrid            // overwrites all grid fields
      };
      return true;
    }
  }
  return false;
}

async function callRunAllLocal(wavPath, audioId) {
  console.log('sending request to pipeline');
  const response = await fetch(paths.runallPath , {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      wav_path: wavPath,
      audio_id: audioId
    })
  });

  const text = await response.text();

  if (!text) {
    console.log("RUNALL RESPONSE: <empty>");
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("RUNALL FAIL JSON:", text);
    return null;
  }
}

async function callWav2TG(wavPath, text = "") {
  const form = new FormData();

  form.append("audio", fs.createReadStream(wavPath));
  form.append("text", text);

  const res = await axios.post(
    `${wav2tgOrigin.server}/wav2textgrid`,
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity
    }
  );

  return res.data;
}









module.exports = {handleVideoUpload, handleAudioUpload, handleTextGridUpload, handleGridUpload, handleUserTextGridUpload, handleCellUpload};