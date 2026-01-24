const express = require('express');
const router = express.Router();
const {handleVideoUpload, handleAudioUpload, handleTextGridUpload, handleGridUpload, handleUserTextGridUpload} = require('../controllers/uploadController');
const diskStorage = require('../middleware/multerStorage');
const storeFile = require('../middleware/multerMemoryStorage');


router.post('/video/:fileName', diskStorage.single("video"), handleVideoUpload);
router.post('/audio/:fileName',diskStorage.single("audio"),handleAudioUpload);
router.put('/:username/textgrids/:fileName', handleUserTextGridUpload)
router.put('/textgrids/:fileName', handleTextGridUpload);
router.put('/grids/:gridId', handleGridUpload);


module.exports = router;