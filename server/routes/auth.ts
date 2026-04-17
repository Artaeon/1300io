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

    res.status(201).json({
      message: 'User created',
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
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

export default router;
