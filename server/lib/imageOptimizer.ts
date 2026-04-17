import path from 'node:path';
import fs from 'node:fs/promises';
import logger from '../logger';

const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 85;

type SharpFactory = (input: string, opts?: { failOn?: 'none' | 'warning' | 'error' }) => SharpPipeline;

interface SharpPipeline {
  rotate(): SharpPipeline;
  resize(opts: { width: number; height: number; fit: string; withoutEnlargement: boolean }): SharpPipeline;
  jpeg(opts: { quality: number; mozjpeg?: boolean }): SharpPipeline;
  png(opts: { compressionLevel: number }): SharpPipeline;
  webp(opts: { quality: number }): SharpPipeline;
  toFile(path: string): Promise<unknown>;
}

let sharp: SharpFactory | null = null;
try {
  sharp = require('sharp') as SharpFactory;
} catch {
  logger.warn('sharp not installed; uploaded images will not be resized');
}

export async function optimize(filePath: string): Promise<void> {
  if (!sharp) return;

  const ext = path.extname(filePath).toLowerCase();
  const tmpPath = `${filePath}.opt${ext}`;

  try {
    let pipeline = sharp(filePath, { failOn: 'none' })
      .rotate()
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
    logger.error('Image optimization failed', {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    try {
      await fs.unlink(tmpPath);
    } catch {
      /* tmp may not exist */
    }
  }
}
