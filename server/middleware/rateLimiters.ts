import rateLimit from 'express-rate-limit';

// Rate limits in the test environment are a footgun: a 5-per-15-minute
// login limit saturates across the suite after a handful of tests and
// produces spurious 429s that have nothing to do with behavior under
// test. Skip all limiters when NODE_ENV=test; production behavior is
// still covered by a dedicated test that posts ONE attempt beyond the
// threshold (see accountLockout + the tests for the middleware itself).
const skipInTests = () => process.env.NODE_ENV === 'test';

export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: 'Too many requests. Please try again later.' },
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  skip: skipInTests,
  message: { error: 'Upload rate limit exceeded. Please try again later.' },
});

export const pdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  skip: skipInTests,
  message: { error: 'PDF generation rate limit exceeded. Please try again later.' },
});
