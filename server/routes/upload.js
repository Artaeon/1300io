const express = require('express');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiters');
const { upload, uploadDir } = require('../middleware/uploadHandler');
const { optimize } = require('../lib/imageOptimizer');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

router.post('/', authenticateToken, uploadLimiter, upload.single('photo'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  // Resize + recompress before returning the URL. Failure is non-fatal —
  // optimize() leaves the original bytes in place and logs.
  await optimize(path.resolve(uploadDir, req.file.filename));

  const publicUrl = `/uploads/${req.file.filename}`;
  res.json({ url: publicUrl });
}));

module.exports = router;
