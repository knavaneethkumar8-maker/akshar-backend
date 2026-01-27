const express = require("express");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

/* helper */
function parseRecordedAt(value) {
  // Example: "27/1/2026, 23:39:53"
  const [datePart, timePart] = value.split(", ");

  const [day, month, year] = datePart.split("/").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds);
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
    .sort((a, b) => {
      return (
        parseRecordedAt(b.recordedAt) -
        parseRecordedAt(a.recordedAt)
      );
    })

    // 3️⃣ take latest 10
    .slice(0, 10)

    // 4️⃣ attach matching textgrid JSON
    .map(item => {
      const baseName = path.parse(item.filename).name;
      const textgridPath = path.join(
        textgridsDir,
        `${baseName}.json`
      );

      let textgrid = null;

      if (fs.existsSync(textgridPath)) {
        try {
          textgrid = JSON.parse(
            fs.readFileSync(textgridPath, "utf-8")
          );
        } catch (err) {
          console.error("Failed to read textgrid:", textgridPath);
        }
      }

      return {
        ...item,
        textgrid
      };
    });

  res.json(result);
});



module.exports = router;
