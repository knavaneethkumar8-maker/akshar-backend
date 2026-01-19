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

dotenv.config();
const PORT = process.env.PORT || 3500;

//config
connectDB();
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({extended : false}));
app.use(logger);
app.use(express.static(path.join(__dirname, 'public')));

//middleware

app.get('/', (req, res) => {
  console.log('request came');
  res.sendFile(path.join(__dirname, "views", "index.html"))
});


app.use('/upload', require('./routes/upload.js'));


mongoose.connection.once('open', () => {
  console.log('Server connected to database');
  app.listen(PORT, () => {
    console.log(`Server running in the port ${PORT}`);
  });
});

