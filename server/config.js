require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  logLevel: process.env.LOG_LEVEL || 'info',
};

// Validate required config on startup
function validateConfig() {
  if (!config.jwtSecret) {
    console.error('FATAL: JWT_SECRET environment variable is required. Server cannot start without it.');
    console.error('Generate one with: openssl rand -base64 32');
    process.exit(1);
  }

  if (config.jwtSecret.length < 16) {
    console.error('FATAL: JWT_SECRET must be at least 16 characters.');
    process.exit(1);
  }
}

const isProduction = config.nodeEnv === 'production';

module.exports = { config, validateConfig, isProduction };
