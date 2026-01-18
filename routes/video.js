const express = require('express');
const router = express.Router();
const {handleVideoUpload} = require('../controllers/videoUploadController');
const upload = require('../middleware/multerStorage');
const storeFile = require('../middleware/multerMemoryStorage');


router.post('/video/:fileName', storeFile.single("video"), handleVideoUpload);


module.exports = router;