const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");

router.get("/wav/:file", (req, res) => {
  const filePath = path.join(
    process.cwd(),
    "uploads/recordings",
    req.params.file
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: "File not found" });
  }

  res.download(filePath);
});


module.exports = router;