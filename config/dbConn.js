const mongoose = require('mongoose');


const connectDB = async () => {
  try {
    await mongoose.connect(process.env.OAUTH_DB_URI);
  } catch(err) {
    console.error(err);
  }

  console.log(process.env.OAUTH_DB_URI);
}

module.exports = connectDB;