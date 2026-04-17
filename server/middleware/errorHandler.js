const { isProduction } = require('../config');
const logger = require('../logger');

// Wrap async route handlers to catch unhandled rejections
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 404 catch-all — must be registered after all routes, before errorHandler
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
    requestId: req.id,
  });
}

// Centralized error handler -- must be registered last in the middleware chain
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;

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
    return res.status(413).json({ error: 'File too large. Maximum size is 10MB.', requestId: req.id });
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field.', requestId: req.id });
  }

  const response = {
    error: err.expose || statusCode < 500 ? err.message : 'Internal server error',
    requestId: req.id,
  };

  if (!isProduction && statusCode >= 500) {
    response.details = err.message;
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

module.exports = { asyncHandler, errorHandler, notFoundHandler };
