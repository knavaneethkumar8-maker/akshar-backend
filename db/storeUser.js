const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, "users.json");

function readUsers() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "{}");
  }

  const data = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(data || "{}");
}

function writeUsers(users) {
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
}

function getUser(username) {
  const users = readUsers();
  return users[username] || null;
}

function addUser(username, password) {
  const users = readUsers();

  if (users[username]) {
    return false;
  }

  users[username] = {
    password,
    createdAt: new Date().toISOString()
  };

  writeUsers(users);
  return true;
}

function validateUser(username, password) {
  const users = readUsers();
  return users[username] && users[username].password === password;
}

function getAllUsers() {
  return readUsers();
}


module.exports = {
  addUser,
  validateUser,
  getUser,
  getAllUsers
}