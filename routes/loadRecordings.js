const express = require("express");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

/* helper */
function parseRecordedAt(value) {
  if (!value.includes("/")) {
    return new Date(value);
  }

  const [datePart, timePart] = value.split(", ");
  const [day, month, year] = datePart.split("/").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

/* route */
router.get("/recordings", (req, res) => {
  const { user, time } = req.query;
  if (!user) return res.status(400).json({ error: "User required" });

  const metaPath = path.join(
    __dirname,
    `../uploads/${user}/recordings/metadata.json`
  );

  if (!fs.existsSync(metaPath)) {
    return res.json([]);
  }

  const data = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  const now = new Date();

  const filtered = data.filter(item => {
    const recordedDate = parseRecordedAt(item.recordedAt);

    if (time === "today") {
      return recordedDate.toDateString() === now.toDateString();
    }

    if (time === "yesterday") {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return recordedDate.toDateString() === y.toDateString();
    }

    if (time === "last-week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return recordedDate >= weekAgo;
    }

    return true;
  });

  res.json(filtered);
});

module.exports = router;
