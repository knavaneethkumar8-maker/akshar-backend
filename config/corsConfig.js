const allowedOrigins = require('./allowedOrigins');

const corsOptions = {
  origin : (origin, callback) => {
    if(allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }, 
  methods : ["POST", "GET"],
  credentials : true
}




module.exports = corsOptions;