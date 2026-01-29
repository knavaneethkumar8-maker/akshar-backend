const express = require('express');
const app = express();
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const connectDB = require('./config/dbConn');
const cors = require('cors');
const corsOptions = require('./config/corsConfig');
const logger = require('./middleware/logEvents');
const session = require('express-session');

dotenv.config();
const PORT = process.env.PORT || 3500;

//config
connectDB();
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({limit : "1000mb"}));
app.use(express.urlencoded({ limit : "1000mb",extended : false}));
app.use(logger);
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: "super-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax"
  }
}));

//middleware
app.get('/', (req, res) => {
  console.log('request came');
  res.sendFile(path.join(__dirname, "views", "index.html"))
});

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".wav")) {
        res.setHeader("Content-Type", "audio/wav");
      }
      if (filePath.endsWith(".mp4")) {
        res.setHeader("Content-Type", "audio/mp4");
      }
    }
  })
);


app.use('/upload', require('./routes/upload.js'));
app.use('/auth', require('./routes/auth.js'));
app.use('/', require('./routes/userUploads.js'));
app.use("/api/users", require('./routes/getUsers.js'));
app.use("/api", require('./routes/loadRecordings.js'));





app.use((err, req, res, next) => {
  console.error(err.stack || err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    message: "Something went wrong"
  });
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

mongoose.connection.once('open', () => {
  console.log('Server connected to database');
});

app.listen(PORT, "0.0.0.0",() => {
  console.log(`Server running in the port ${PORT}`);
});

