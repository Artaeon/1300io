import { config, isProduction } from './config';
import type { LogLevel } from './config';

const LOG_LEVELS: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
};

const currentLevel = LOG_LEVELS[config.logLevel] ?? LOG_LEVELS.info;

interface LogContext {
  requestId?: string;
  userId?: number | string;
  [key: string]: unknown;
}

interface LogEntry extends LogContext {
  timestamp: string;
  level: LogLevel;
  msg: string;
}

function formatMessage(level: LogLevel, msg: string, data?: LogContext): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    msg,
  };

  if (data) {
    if (data.requestId !== undefined) entry.requestId = data.requestId;
    if (data.userId !== undefined) entry.userId = data.userId;
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'requestId' && key !== 'userId') {
        entry[key] = value;
      }
    }
  }

  return isProduction
    ? JSON.stringify(entry)
    : `[${entry.timestamp}] ${level.toUpperCase()} ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
}

function shouldLog(level: LogLevel): boolean {
  return (LOG_LEVELS[level] ?? 0) <= currentLevel;
}

interface Logger {
  fatal(msg: string, data?: LogContext): void;
  error(msg: string, data?: LogContext): void;
  warn(msg: string, data?: LogContext): void;
  info(msg: string, data?: LogContext): void;
  debug(msg: string, data?: LogContext): void;
  trace(msg: string, data?: LogContext): void;
}

const logger: Logger = {
  fatal: (msg, data) => { if (shouldLog('fatal')) console.error(formatMessage('fatal', msg, data)); },
  error: (msg, data) => { if (shouldLog('error')) console.error(formatMessage('error', msg, data)); },
  warn:  (msg, data) => { if (shouldLog('warn'))  console.warn(formatMessage('warn',  msg, data)); },
  info:  (msg, data) => { if (shouldLog('info'))  console.log(formatMessage('info',   msg, data)); },
  debug: (msg, data) => { if (shouldLog('debug')) console.log(formatMessage('debug',  msg, data)); },
  trace: (msg, data) => { if (shouldLog('trace')) console.log(formatMessage('trace',  msg, data)); },
};

export = logger;
