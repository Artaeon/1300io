import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import prisma from '../lib/prisma';
import { config } from '../config';
import {
  registerSchema,
  loginSchema,
  validateBody,
} from '../schemas';
import { asyncHandler } from '../middleware/errorHandler';
import { createAuditEntry, getAuditContext } from '../audit';
import { sendMail } from '../lib/mailer';
import { verificationEmail } from '../lib/emailTemplates';
import { checkPasswordPolicy } from '../lib/passwordPolicy';
import logger from '../logger';
import type { User } from '@prisma/client';

const router = Router();

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function generateAccessToken(user: Pick<User, 'id' | 'role' | 'organizationId'>): string {
  return jwt.sign(
    { userId: user.id, role: user.role, organizationId: user.organizationId ?? null },
    config.jwtSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY },
  );
}

function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

type Register = import('zod').infer<typeof registerSchema>;
type Login = import('zod').infer<typeof loginSchema>;

// Clear-text-ish audit metadata. Email is stored (not hashed) because
// regulators want to answer "show me every login by user X" — not
// feasible with a hashed email. IP + UA are already captured. The
// ephemeral access token is never logged; the refresh token only
// by its first 8 chars for support correlation.
function refreshTokenFingerprint(token: string): string {
  return `${token.slice(0, 8)}…`;
}

const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_MINUTES = 60;

async function issueEmailVerificationToken(userId: number): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 3600 * 1000);
  await prisma.emailVerificationToken.create({
    data: { token, userId, expiresAt },
  });
  return token;
}

router.post(
  '/register',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.validatedBody as Register;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, role: 'INSPECTOR' },
    });

    await createAuditEntry({
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      ...getAuditContext(req),
      newData: { email, name, role: user.role, self: true },
    });

    // Fire the verification email. Best-effort: if SMTP is down, the
    // user can request a fresh link via /request-verification instead
    // of being stuck.
    try {
      const token = await issueEmailVerificationToken(user.id);
      const mail = verificationEmail(user.name, token);
      await sendMail({ to: user.email, ...mail });
    } catch (err) {
      logger.warn('Failed to send verification email at register', {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    res.status(201).json({
      message: 'User created',
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      emailVerificationSent: true,
    });
  }),
);

router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.validatedBody as Login;
    const ctx = getAuditContext(req);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      // Log failure even when user doesn't exist — security team cares
      // about "who tried which email, from where, how often". Don't
      // stuff the attempted password anywhere, for obvious reasons.
      await createAuditEntry({
        action: 'LOGIN_FAILURE',
        entityType: 'User',
        entityId: user?.id ?? 0,
        userId: user?.id ?? null,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        newData: { email, reason: user ? 'bad_password' : 'unknown_user' },
      });
      logger.warn('Failed login', {
        email,
        ip: ctx.ipAddress,
        reason: user ? 'bad_password' : 'unknown_user',
        requestId: req.id,
      });
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Opt-in verification gate. Only active when REQUIRE_EMAIL_VERIFICATION=true
    // so existing deployments and the admin-seed flow don't break.
    if (config.requireEmailVerification && !user.emailVerified) {
      await createAuditEntry({
        action: 'LOGIN_FAILURE',
        entityType: 'User',
        entityId: user.id,
        userId: user.id,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        newData: { email, reason: 'email_not_verified' },
      });
      res.status(403).json({
        error: 'E-Mail-Adresse noch nicht bestätigt. Bitte prüfen Sie Ihr Postfach.',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: { token: refreshToken, userId: user.id, expiresAt },
    });

    await createAuditEntry({
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      newData: { email, refreshTokenPrefix: refreshTokenFingerprint(refreshToken) },
    });
    logger.info('Login success', { userId: user.id, ip: ctx.ipAddress, requestId: req.id });

    res.json({
      token: accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  }),
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: unknown };
    const ctx = getAuditContext(req);
    if (typeof refreshToken !== 'string') {
      res.status(400).json({ error: 'Refresh token required' });
      return;
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored) {
      // Token reuse (we already rotated it) is suspicious — audit it.
      await createAuditEntry({
        action: 'LOGIN_FAILURE',
        entityType: 'User',
        entityId: 0,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
        newData: {
          reason: 'invalid_refresh_token',
          refreshTokenPrefix: refreshTokenFingerprint(refreshToken),
        },
      });
      logger.warn('Invalid refresh token', {
        ip: ctx.ipAddress,
        prefix: refreshTokenFingerprint(refreshToken),
        requestId: req.id,
      });
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    await prisma.refreshToken.delete({ where: { id: stored.id } });

    if (stored.expiresAt < new Date()) {
      res.status(401).json({ error: 'Refresh token expired' });
      return;
    }

    const newAccessToken = generateAccessToken(stored.user);
    const newRefreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: stored.user.id, expiresAt },
    });

    await createAuditEntry({
      action: 'TOKEN_REFRESH',
      entityType: 'User',
      entityId: stored.user.id,
      userId: stored.user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      newData: { refreshTokenPrefix: refreshTokenFingerprint(newRefreshToken) },
    });

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: stored.user.id,
        email: stored.user.email,
        name: stored.user.name,
        role: stored.user.role,
      },
    });
  }),
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: unknown };
    if (typeof refreshToken === 'string') {
      const stored = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        select: { userId: true },
      });
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
      if (stored) {
        const ctx = getAuditContext(req);
        await createAuditEntry({
          action: 'LOGOUT',
          entityType: 'User',
          entityId: stored.userId,
          userId: stored.userId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        });
      }
    }
    res.json({ message: 'Logged out' });
  }),
);

// --- Email verification ---

// Consume a verification token. If valid: flip emailVerified=true,
// delete the token, and return success. Tokens are single-use.
// We deliberately return the same 400 for every failure mode (unknown
// token, expired, already used) so a scan can't differentiate them.
router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = req.body as { token?: unknown };
    if (typeof token !== 'string' || token.length < 16) {
      res.status(400).json({ error: 'Invalid verification token' });
      return;
    }

    const stored = await prisma.emailVerificationToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invalid verification token' });
      return;
    }

    // Consume the token + any siblings for this user (one success is
    // enough; don't leave usable tokens behind if a resend happened).
    await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      prisma.emailVerificationToken.deleteMany({
        where: { userId: stored.userId, id: { not: stored.id } },
      }),
      prisma.user.update({
        where: { id: stored.userId },
        data: { emailVerified: true },
      }),
    ]);

    await createAuditEntry({
      action: 'UPDATE',
      entityType: 'User',
      entityId: stored.userId,
      ...getAuditContext(req),
      userId: stored.userId,
      previousData: { emailVerified: false },
      newData: { emailVerified: true, via: 'verification_token' },
    });

    res.json({ message: 'Email verified', email: stored.user.email });
  }),
);

// Resend / request a new verification email. Always returns 200 to
// avoid leaking whether an address exists. Rate-limited at the gateway.
router.post(
  '/request-verification',
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email?: unknown };
    const genericOk = () => res.json({ message: 'If the address exists and is unverified, a new link has been sent.' });

    if (typeof email !== 'string' || !email.includes('@')) {
      genericOk();
      return;
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerified) {
      genericOk();
      return;
    }

    try {
      const token = await issueEmailVerificationToken(user.id);
      const mail = verificationEmail(user.name, token);
      await sendMail({ to: user.email, ...mail });
    } catch (err) {
      logger.warn('request-verification: send failed', {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    genericOk();
  }),
);

// --- Password reset ---

// Request a reset link. Always responds 200 to prevent user enumeration.
router.post(
  '/request-password-reset',
  asyncHandler(async (req, res) => {
    const { email } = req.body as { email?: unknown };
    // Respond identically whether the user exists or not.
    const genericOk = () =>
      res.json({ message: 'If the address exists, a reset link has been sent.' });

    if (typeof email !== 'string' || !email.includes('@')) {
      genericOk();
      return;
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      genericOk();
      return;
    }

    try {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000);
      await prisma.passwordResetToken.create({
        data: { token, userId: user.id, expiresAt },
      });

      // Lazy-load to avoid circular with emailTemplates
      const { passwordResetEmail } = await import('../lib/emailTemplates');
      const mail = passwordResetEmail(user.name, token);
      await sendMail({ to: user.email, ...mail });

      await createAuditEntry({
        action: 'UPDATE',
        entityType: 'User',
        entityId: user.id,
        ...getAuditContext(req),
        userId: user.id,
        newData: { passwordResetRequested: true },
      });
    } catch (err) {
      logger.warn('request-password-reset: send failed', {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    genericOk();
  }),
);

// Consume a reset token + set a new password. Single-use — usedAt is
// flipped in the same transaction that updates the password, so a race
// can't double-spend the token. Also invalidates all active refresh
// tokens so any session on a stolen device is kicked out.
router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as { token?: unknown; password?: unknown };
    if (typeof token !== 'string' || token.length < 16) {
      res.status(400).json({ error: 'Invalid reset token' });
      return;
    }
    if (typeof password !== 'string') {
      res.status(400).json({ error: 'Password is required' });
      return;
    }
    const policy = checkPasswordPolicy(password);
    if (!policy.ok) {
      res.status(400).json({ error: policy.reasons.join(' ') });
      return;
    }

    const stored = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      res.status(400).json({ error: 'Invalid reset token' });
      return;
    }

    const hashed = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: stored.userId },
        data: { password: hashed },
      }),
      prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      // Kick every active session on every device — standard response
      // to any credential change for the account. Users re-login.
      prisma.refreshToken.deleteMany({ where: { userId: stored.userId } }),
      // Burn any still-outstanding reset tokens for this user.
      prisma.passwordResetToken.deleteMany({
        where: { userId: stored.userId, id: { not: stored.id } },
      }),
    ]);

    await createAuditEntry({
      action: 'UPDATE',
      entityType: 'User',
      entityId: stored.userId,
      ...getAuditContext(req),
      userId: stored.userId,
      newData: { passwordReset: true, sessionsInvalidated: true },
    });
    logger.info('Password reset', { userId: stored.userId, requestId: req.id });

    res.json({ message: 'Password reset. Please log in again.' });
  }),
);

export default router;
