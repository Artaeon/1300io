import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { config } from '../config';
import { asyncHandler } from '../middleware/errorHandler';
import { createAuditEntry, getAuditContext } from '../audit';
import { checkPasswordPolicy, passwordPolicyMin } from '../lib/passwordPolicy';
import { validateBody } from '../schemas';
import logger from '../logger';

const router = Router();

const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const ACCESS_TOKEN_EXPIRY = '15m';

const initializeSchema = z.object({
  admin: z.object({
    email: z.string().email('Invalid email format'),
    password: z
      .string()
      .min(passwordPolicyMin, `Passwort muss mindestens ${passwordPolicyMin} Zeichen lang sein`)
      .superRefine((pw, ctx) => {
        const result = checkPasswordPolicy(pw);
        if (!result.ok) {
          for (const reason of result.reasons) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: reason });
          }
        }
      }),
    name: z.string().min(1, 'Name is required').max(200),
  }),
  organization: z.object({
    name: z.string().min(1, 'Organization name is required').max(200),
  }),
});

type Initialize = z.infer<typeof initializeSchema>;

async function anyAdminExists(): Promise<boolean> {
  const count = await prisma.user.count({ where: { role: 'ADMIN' } });
  return count > 0;
}

// Public — checks whether the instance has completed first-run setup.
// Any ADMIN user counts as "initialized". No DB writes, no auth.
router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const initialized = await anyAdminExists();
    res.json({ initialized });
  }),
);

// Public — ONE-SHOT. Creates the first ADMIN user + their Organization
// in a single transaction and returns working session tokens. Refuses
// with 409 once any ADMIN exists, so this endpoint self-destructs after
// first success. The admin is auto-marked emailVerified since the
// operator ran this by hand and there is no SMTP path at install time.
router.post(
  '/initialize',
  validateBody(initializeSchema),
  asyncHandler(async (req, res) => {
    const { admin, organization } = req.validatedBody as Initialize;
    const ctx = getAuditContext(req);

    if (await anyAdminExists()) {
      res.status(409).json({ error: 'Setup has already been completed.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(admin.password, 12);
    const refreshToken = randomBytes(48).toString('base64url');
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Re-check inside the transaction so two concurrent POSTs cannot
    // both succeed. The count() runs on the same snapshot as the
    // create(), so the second one sees the first and aborts.
    const result = await prisma.$transaction(async (tx) => {
      const alreadyAdmin = await tx.user.count({ where: { role: 'ADMIN' } });
      if (alreadyAdmin > 0) {
        throw Object.assign(new Error('ALREADY_INITIALIZED'), { kind: 'conflict' });
      }

      const org = await tx.organization.create({
        data: { name: organization.name },
      });

      const user = await tx.user.create({
        data: {
          email: admin.email,
          password: hashedPassword,
          name: admin.name,
          role: 'ADMIN',
          emailVerified: true,
          organizationId: org.id,
        },
      });

      await tx.refreshToken.create({
        data: { token: refreshToken, userId: user.id, expiresAt: refreshExpiresAt },
      });

      return { user, org };
    }).catch((err: { kind?: string }) => {
      if (err.kind === 'conflict') return null;
      throw err;
    });

    if (!result) {
      res.status(409).json({ error: 'Setup has already been completed.' });
      return;
    }

    const { user, org } = result;

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, organizationId: user.organizationId },
      config.jwtSecret,
      { expiresIn: ACCESS_TOKEN_EXPIRY },
    );

    await createAuditEntry({
      action: 'CREATE',
      entityType: 'Organization',
      entityId: org.id,
      userId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      newData: { name: org.name, initialSetup: true },
    });
    await createAuditEntry({
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      newData: {
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: org.id,
        initialSetup: true,
      },
    });
    await createAuditEntry({
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      userId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      newData: { email: user.email, initialSetup: true },
    });

    logger.info('Initial setup completed', {
      userId: user.id,
      organizationId: org.id,
      ip: ctx.ipAddress,
      requestId: req.id,
    });

    res.status(201).json({
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
      },
      organization: { id: org.id, name: org.name },
    });
  }),
);

export default router;
