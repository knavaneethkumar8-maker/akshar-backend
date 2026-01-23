const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const router = express.Router();

const USERS_FILE = path.join(__dirname, "../db/users.json");

/* Helper: read users */
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8") || "{}");
}

/* Helper: write users */
function writeUsers(data) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

router.get("/", (req, res) => {
  try {
    const users = readUsers();
    res.json(Object.keys(users));
  } catch (err) {
    res.status(500).json({ error: "Failed to load users" });
  }
});

router.post("/", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "username and password required" });
  }

  try {
    const users = readUsers();

    users[username] = {
      password,
      createdAt: new Date().toISOString()
    };

    writeUsers(users);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save user" });
  }
});

module.exports = router;
