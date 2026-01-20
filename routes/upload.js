const express = require('express');
const router = express.Router();
const {handleVideoUpload, handleAudioUpload, handleTextGridUpload} = require('../controllers/uploadController');
const upload = require('../middleware/multerStorage');
const storeFile = require('../middleware/multerMemoryStorage');


router.post('/video/:fileName', storeFile.single("video"), handleVideoUpload);
router.post('/audio/:fileName', storeFile.single("audio"), handleAudioUpload);
router.put('/textgrids/:fileName', handleTextGridUpload);


module.exports = router;