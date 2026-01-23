const express = require('express');
const router = express.Router();
const {
  addUser,
  validateUser,
  getUser,
  getAllUsers
} = require('../db/storeUser.js');

//const users = {}; // { username: password }

router.post("/signup", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const success = addUser(username, password);

  if (!success) {
    return res.status(409).json({ message: "User already exists" });
  }

  res.json({ message: "Signup successful" });
});


router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!validateUser(username, password)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  req.session.user = { username };

  res.json({
    message: "Login successful",
    username
  });
});



router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  res.json(req.session.user);
});


router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});



module.exports = router;