import type { Request, Response, NextFunction } from 'express';
import logger from '../logger';
import prisma from '../lib/prisma';
import { createAuditEntry, getAuditContext } from '../audit';

/**
 * Per-email login lockout. The existing IP-based loginLimiter slows
 * a single attacker down; this closes the hole where a botnet cycles
 * through residential IPs to grind a single account ('credential
 * stuffing').
 *
 * Algorithm:
 *   - Look up the last N failed LOGIN_FAILURE audit rows for the
 *     attempted email within the last WINDOW_MS
 *   - If count >= MAX_ATTEMPTS, reject the request with 429 and emit
 *     an ACCOUNT_LOCKED audit row (but only once per window, to avoid
 *     flooding the log)
 *
 * Implementation deliberately uses the audit table rather than a
 * separate in-memory cache, so the behavior is shared across server
 * replicas and survives a restart. This costs one indexed query per
 * login attempt — negligible next to bcrypt.compare().
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

export async function checkLockout(req: Request, res: Response, next: NextFunction): Promise<void> {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : null;
  if (!email) return next();

  const since = new Date(Date.now() - WINDOW_MS);
  try {
    // Find audit rows for LOGIN_FAILURE where the newData blob contains
    // this email. Prisma JSON filtering on String columns isn't
    // straightforward, so we match with a substring — acceptable because
    // the blob is produced by us (createAuditEntry stringifies newData)
    // and the email is escaped by JSON.stringify.
    const needle = `"email":"${email.replace(/[\\"]/g, '\\$&')}"`;
    const failures = await prisma.auditLog.count({
      where: {
        action: 'LOGIN_FAILURE',
        timestamp: { gte: since },
        newData: { contains: needle },
      },
    });

    if (failures >= MAX_ATTEMPTS) {
      const ctx = getAuditContext(req);
      // Only record the ACCOUNT_LOCKED row the first time we cross the
      // threshold in this window, so a botnet hammering the endpoint
      // doesn't turn the audit log into its own metric.
      const alreadyLocked = await prisma.auditLog.findFirst({
        where: {
          action: 'ACCOUNT_LOCKED',
          timestamp: { gte: since },
          newData: { contains: needle },
        },
        select: { id: true },
      });
      if (!alreadyLocked) {
        await createAuditEntry({
          action: 'ACCOUNT_LOCKED',
          entityType: 'User',
          entityId: 0,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          newData: { email, failures, windowMinutes: WINDOW_MS / 60000 },
        });
      }
      logger.warn('Login blocked (account lockout)', {
        email,
        failures,
        ip: ctx.ipAddress,
        requestId: req.id,
      });
      res.status(429).json({
        error: 'Zu viele fehlgeschlagene Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.',
      });
      return;
    }
  } catch (err) {
    // Don't fail-open silently in prod: if the lockout check itself
    // errors we log but still let auth proceed so a DB hiccup doesn't
    // lock every user out. The per-IP loginLimiter is the backstop.
    logger.error('checkLockout failed', {
      error: err instanceof Error ? err.message : String(err),
      requestId: req.id,
    });
  }
  next();
}
