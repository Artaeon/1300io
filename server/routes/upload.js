const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiters');
const { upload } = require('../middleware/uploadHandler');

const router = express.Router();

router.post('/', authenticateToken, uploadLimiter, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  const publicUrl = `/uploads/${req.file.filename}`;
  res.json({ url: publicUrl });
});

module.exports = router;
