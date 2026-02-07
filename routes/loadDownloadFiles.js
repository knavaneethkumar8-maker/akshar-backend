const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

const METADATA_PATH = path.join(
  __dirname,
  "..",
  "uploads",
  "recordings",
  "metadata.json"
);

router.get("/downloads", async (req, res) => {
  try {
    if (!fs.existsSync(METADATA_PATH)) {
      return res.json([]);
    }

    const metadata = JSON.parse(
      fs.readFileSync(METADATA_PATH, "utf8")
    );

    const latestNew = metadata
      .filter(r => r.status === "NEW")
      .slice(-20)
      .reverse();

    res.json(latestNew);

  } catch (err) {
    console.error("DOWNLOAD API ERROR:", err);
    res.status(500).json({ message: "Failed to load downloads" });
  }
});

module.exports = router;
