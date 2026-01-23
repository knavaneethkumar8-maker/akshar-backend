const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');
const store = require('../middleware/storage.js');


router.post(
  "/:user/recordings/:filename",
  store.single("file"),
  async (req, res) => {
    try {
      const { user } = req.params;
      const metadata = JSON.parse(req.body.metadata);

      const metaFile = path.join(__dirname, "..", "uploads", user,"recordings", "metadata.json");

      let existing = [];
      if (await fs.pathExists(metaFile)) {
        existing = await fs.readJson(metaFile);
      }

      existing.push(metadata);
      await fs.writeJson(metaFile, existing, { spaces: 2 });

      res.json({ message: "Saved successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Storage failed" });
    }
  }
);

module.exports = router;
