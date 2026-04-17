import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { createAuditEntry, getAuditContext } from '../audit';
import {
  createUserSchema,
  updateUserSchema,
  idParamSchema,
  validateBody,
  validateParams,
} from '../schemas';
import type { z } from 'zod';

const router = Router();

type CreateUser = z.infer<typeof createUserSchema>;
type UpdateUser = z.infer<typeof updateUserSchema>;
type IdParam = z.infer<typeof idParamSchema>;

router.get(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        organizationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(users);
  }),
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validateBody(createUserSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name, role } = req.validatedBody as CreateUser;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name, role },
    });

    await createAuditEntry({
      action: 'CREATE',
      entityType: 'User',
      entityId: user.id,
      ...getAuditContext(req),
      newData: { email, name, role },
    });
    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    });
  }),
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validateParams(idParamSchema),
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const body = req.validatedBody as UpdateUser;
    const data: Partial<{ email: string; password: string; name: string; role: string }> = {
      ...body,
    };
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }

    if (data.email && data.email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
    });

    await createAuditEntry({
      action: 'UPDATE',
      entityType: 'User',
      entityId: updated.id,
      ...getAuditContext(req),
      previousData: { email: user.email, name: user.name, role: user.role },
      newData: { email: updated.email, name: updated.name, role: updated.role },
    });
    res.json(updated);
  }),
);

router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.id === req.user?.userId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id } });

    await createAuditEntry({
      action: 'DELETE',
      entityType: 'User',
      entityId: id,
      ...getAuditContext(req),
      previousData: { email: user.email, name: user.name, role: user.role },
    });
    res.json({ message: 'User deleted' });
  }),
);

export default router;
