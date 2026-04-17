import type { Request, Response, NextFunction, RequestHandler, ErrorRequestHandler } from 'express';
import { isProduction } from '../config';
import logger from '../logger';

interface HttpError extends Error {
  statusCode?: number;
  status?: number;
  expose?: boolean;
  code?: string;
}

// Wrap async route handlers to catch unhandled rejections.
export function asyncHandler<T extends RequestHandler>(fn: T): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 catch-all — registered after all routes, before errorHandler.
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
    requestId: req.id,
  });
}

// Centralized error handler — must be last in the middleware chain.
export const errorHandler: ErrorRequestHandler = (err: HttpError, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.statusCode ?? err.status ?? 500;

  const logContext = {
    requestId: req.id,
    userId: req.user?.userId,
    method: req.method,
    path: req.originalUrl,
    status: statusCode,
    ip: req.ip,
  };

  if (statusCode >= 500) {
    logger.error(`Unhandled error: ${err.message}`, { ...logContext, stack: err.stack });
  } else {
    logger.warn(`Request error: ${err.message}`, logContext);
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'File too large. Maximum size is 10MB.', requestId: req.id });
    return;
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({ error: 'Unexpected file field.', requestId: req.id });
    return;
  }

  const response: Record<string, unknown> = {
    error: err.expose || statusCode < 500 ? err.message : 'Internal server error',
    requestId: req.id,
  };

  if (!isProduction && statusCode >= 500) {
    response.details = err.message;
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
