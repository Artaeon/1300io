import { Router } from 'express';
import path from 'node:path';
import { authenticateToken } from '../middleware/auth';
import { uploadLimiter } from '../middleware/rateLimiters';
import { upload, uploadDir } from '../middleware/uploadHandler';
import { optimize } from '../lib/imageOptimizer';
import { asyncHandler } from '../middleware/errorHandler';

const router = Router();

router.post(
  '/',
  authenticateToken,
  uploadLimiter,
  upload.single('photo'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded.' });
      return;
    }
    await optimize(path.resolve(uploadDir, req.file.filename));

    const publicUrl = `/uploads/${req.file.filename}`;
    res.json({ url: publicUrl });
  }),
);

export default router;
