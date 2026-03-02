const { isProduction } = require('../config');
const logger = require('../logger');

// Wrap async route handlers to catch unhandled rejections
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Centralized error handler -- must be registered last in the middleware chain
function errorHandler(err, req, res, _next) {
  logger.error(`${req.method} ${req.path}: ${err.message}`);

  if (!isProduction) {
    logger.debug('Stack trace', { stack: err.stack });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 10MB.' });
  }

  // Multer unexpected field
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected file field.' });
  }

  const statusCode = err.statusCode || 500;
  const response = { error: err.expose ? err.message : 'Internal server error' };

  if (!isProduction && err.message) {
    response.details = err.message;
  }

  res.status(statusCode).json(response);
}

module.exports = { asyncHandler, errorHandler };
