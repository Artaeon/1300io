const path = require('path');
const fs = require('fs/promises');
const logger = require('../logger');

const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 85;

let sharp = null;
try {
  sharp = require('sharp');
} catch {
  logger.warn('sharp not installed; uploaded images will not be resized');
}

async function optimize(filePath) {
  if (!sharp) return;

  const ext = path.extname(filePath).toLowerCase();
  const tmpPath = `${filePath}.opt${ext}`;

  try {
    let pipeline = sharp(filePath, { failOn: 'none' })
      .rotate() // apply EXIF orientation, then strip it below
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      });

    if (ext === '.jpg' || ext === '.jpeg') {
      pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    } else if (ext === '.png') {
      pipeline = pipeline.png({ compressionLevel: 9 });
    } else if (ext === '.webp') {
      pipeline = pipeline.webp({ quality: JPEG_QUALITY });
    }

    await pipeline.toFile(tmpPath);
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    logger.error('Image optimization failed', { filePath, error: err.message });
    // Leave the original file in place so the upload still succeeds.
    try {
      await fs.unlink(tmpPath);
    } catch {
      /* tmp may not exist */
    }
  }
}

module.exports = { optimize };
