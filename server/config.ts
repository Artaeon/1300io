import 'dotenv/config';

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface SmtpConfig {
  host: string | null;
  port: number;
  secure: boolean;
  user: string | null;
  pass: string | null;
  from: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  databaseUrl: string;
  frontendUrl: string;
  uploadDir: string;
  logLevel: LogLevel;
  smtp: SmtpConfig;
  requireEmailVerification: boolean;
}

const rawConfig = {
  port: parseInt(process.env.PORT ?? '', 10) || 3000,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: process.env.JWT_SECRET ?? '',
  databaseUrl: process.env.DATABASE_URL ?? 'file:./dev.db',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  logLevel: (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info',
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || 'no-reply@1300.io',
  },
  // Opt-in login gate. When true, users cannot log in until they've
  // clicked the verification link. Default off to not break existing
  // deployments or the demo-admin seed flow.
  requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
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

  if (config.requireEmailVerification && !config.smtp.host) {
    console.error('FATAL: REQUIRE_EMAIL_VERIFICATION=true but SMTP_HOST is not set.');
    console.error('Either disable the gate or configure an SMTP server.');
    process.exit(1);
  }
}
