const rateLimit = require('express-rate-limit');

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Upload rate limit exceeded. Please try again later.' },
});

const pdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'PDF generation rate limit exceeded. Please try again later.' },
});

module.exports = { globalLimiter, loginLimiter, uploadLimiter, pdfLimiter };
