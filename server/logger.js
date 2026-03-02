const { config, isProduction } = require('./config');

const LOG_LEVELS = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, trace: 5 };

const currentLevel = LOG_LEVELS[config.logLevel] ?? LOG_LEVELS.info;

function formatMessage(level, msg, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    msg,
  };

  if (data) {
    if (data.requestId) entry.requestId = data.requestId;
    if (data.userId) entry.userId = data.userId;
    Object.keys(data).forEach(key => {
      if (key !== 'requestId' && key !== 'userId') {
        entry[key] = data[key];
      }
    });
  }

  return isProduction ? JSON.stringify(entry) : `[${entry.timestamp}] ${level.toUpperCase()} ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
}

function shouldLog(level) {
  return (LOG_LEVELS[level] ?? 0) <= currentLevel;
}

const logger = {
  fatal: (msg, data) => shouldLog('fatal') && console.error(formatMessage('fatal', msg, data)),
  error: (msg, data) => shouldLog('error') && console.error(formatMessage('error', msg, data)),
  warn: (msg, data) => shouldLog('warn') && console.warn(formatMessage('warn', msg, data)),
  info: (msg, data) => shouldLog('info') && console.log(formatMessage('info', msg, data)),
  debug: (msg, data) => shouldLog('debug') && console.log(formatMessage('debug', msg, data)),
  trace: (msg, data) => shouldLog('trace') && console.log(formatMessage('trace', msg, data)),
};

module.exports = logger;
