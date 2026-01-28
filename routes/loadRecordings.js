const express = require("express");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

/* helper */
function parseRecordedAt(value) {
  const [datePart, timePart] = value.split(", ");
  const [day, month, year] = datePart.split("/").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/* helper: get latest textgrid version */
function getLatestTextgrid(baseName, textgridsDir) {
  if (!fs.existsSync(textgridsDir)) return null;

  const files = fs.readdirSync(textgridsDir);

  const regex = new RegExp(`^${baseName}(?:_v(\\d+))?\\.json$`);

  let latestFile = null;
  let maxVersion = 0;

  for (const file of files) {
    const match = file.match(regex);
    if (!match) continue;

    const version = match[1] ? parseInt(match[1], 10) : 1;

    if (version > maxVersion) {
      maxVersion = version;
      latestFile = file;
    }
  }

  if (!latestFile) return null;

  try {
    return JSON.parse(
      fs.readFileSync(path.join(textgridsDir, latestFile), "utf-8")
    );
  } catch (err) {
    console.error("Failed to read textgrid:", latestFile);
    return null;
  }
}

/* route */
router.get("/recordings", (req, res) => {
  const recordingsMetaPath = path.join(
    __dirname,
    "../uploads/recordings/metadata.json"
  );

  const textgridsDir = path.join(
    __dirname,
    "../uploads/textgrids"
  );

  if (!fs.existsSync(recordingsMetaPath)) {
    return res.json([]);
  }

  const data = JSON.parse(
    fs.readFileSync(recordingsMetaPath, "utf-8")
  );

  const result = data
    // 1️⃣ only NEW recordings
    .filter(item => item.status === "NEW")

    // 2️⃣ latest first
    .sort((a, b) =>
      parseRecordedAt(b.recordedAt) - parseRecordedAt(a.recordedAt)
    )

    // 3️⃣ take latest 10
    .slice(0, 10)

    // 4️⃣ attach latest textgrid only
    .map(item => {
      const baseName = path.parse(item.filename).name;
      const textgrid = getLatestTextgrid(baseName, textgridsDir);

      return {
        ...item,
        textgrid
      };
    });

  res.json(result);
});

module.exports = router;
