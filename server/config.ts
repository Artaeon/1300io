import 'dotenv/config';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  databaseUrl: string;
  frontendUrl: string;
  uploadDir: string;
  logLevel: LogLevel;
}

// Use a mutable shape during construction; validateConfig() hardens it.
const rawConfig = {
  port: parseInt(process.env.PORT ?? '', 10) || 3000,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? '',
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  logLevel: (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info',
};

export const config: AppConfig = rawConfig;

export const isProduction: boolean = config.nodeEnv === 'production';

export function validateConfig(): void {
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
