import nodemailer, { type Transporter } from 'nodemailer';
import logger from '../logger';
import { config } from '../config';

/**
 * SMTP mailer.
 *
 * Behavior:
 *   - If SMTP_HOST is set, a real SMTP transport is created (nodemailer
 *     handles connection pooling + retries internally).
 *   - If unset, the module falls back to a 'jsonTransport' that only
 *     logs — useful for dev without MailHog, and for tests. No
 *     outbound traffic in this mode.
 *
 * `sendMail` never throws into the caller's request path: email
 * problems become audited `warn` logs and return false. The caller
 * decides whether to surface a generic 'check your email' message
 * regardless (recommended for verification/reset — avoids leaking
 * which email addresses exist).
 */

let transporter: Transporter | null = null;
let transportKind: 'smtp' | 'json' = 'json';

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (config.smtp.host) {
    const auth = config.smtp.user && config.smtp.pass
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined;
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth,
    });
    transportKind = 'smtp';
    logger.info('Mailer: SMTP transport configured', {
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
    transportKind = 'json';
    logger.info('Mailer: no SMTP_HOST set; using jsonTransport (logs only, no outbound email)');
  }
  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendMail(msg: MailMessage): Promise<boolean> {
  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: config.smtp.from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    if (transportKind === 'json') {
      // Logs the rendered message so devs can copy links out without
      // a real SMTP server.
      logger.info('Mailer (jsonTransport)', {
        to: msg.to,
        subject: msg.subject,
        body: msg.text,
      });
    } else {
      logger.info('Mailer: message sent', {
        to: msg.to,
        subject: msg.subject,
        messageId: info.messageId,
      });
    }
    return true;
  } catch (err) {
    logger.warn('Mailer: send failed', {
      to: msg.to,
      subject: msg.subject,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// Exposed for tests — lets them swap in an in-memory transport without
// hitting the global singleton.
export function __setTransporterForTests(t: Transporter | null): void {
  transporter = t;
  transportKind = t ? 'json' : 'json';
}
