const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const dayjs = require('dayjs');


const logEvents = async (message, fileName) => {
  const today = dayjs();
  const date = today.format('dddd MMMM YYYY HH:mm');
  const logItem = `${date} \t ${message}`;
  try {
    if(!fs.existsSync(path.join(__dirname,"..", "logs"))) {
      await fsPromises.mkdir(path.join(__dirname, "..", "logs"));
    }
    await fsPromises.appendFile(path.join(__dirname, "..", "logs", fileName), logItem);
  } catch (err) {
    console.error(err);
  }
}


const logger = async (req, res, next) => {
  const message = `${req.origin} ${req.url} ${req.method} \n`;
  console.log(`${req.origin} ${req.url} ${req.method}`);
  logEvents(message, 'reqLog.txt');
  next();
}


module.exports = logger;