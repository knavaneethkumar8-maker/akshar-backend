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
  const metaPath = path.join(
    __dirname,
    "../uploads/recordings/metadata.json"
  );

  if (!fs.existsSync(metaPath)) {
    return res.json([]);
  }

  const data = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

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
    .slice(0, 10);
  console.log(result);
  res.json(result);
});


module.exports = router;
