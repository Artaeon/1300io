import { Router } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { createAuditEntry, getAuditContext } from '../audit';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  idParamSchema,
  validateBody,
  validateParams,
} from '../schemas';
import type { z } from 'zod';

const router = Router();

type CreateOrg = z.infer<typeof createOrganizationSchema>;
type UpdateOrg = z.infer<typeof updateOrganizationSchema>;
type IdParam = z.infer<typeof idParamSchema>;

router.get(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN'),
  asyncHandler(async (_req, res) => {
    const orgs = await prisma.organization.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, properties: true } },
      },
    });
    res.json(orgs);
  }),
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validateBody(createOrganizationSchema),
  asyncHandler(async (req, res) => {
    const { name } = req.validatedBody as CreateOrg;
    const org = await prisma.organization.create({ data: { name } });
    await createAuditEntry({
      action: 'CREATE',
      entityType: 'Organization',
      entityId: org.id,
      ...getAuditContext(req),
      newData: org,
    });
    res.status(201).json(org);
  }),
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validateParams(idParamSchema),
  validateBody(updateOrganizationSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: req.validatedBody as UpdateOrg,
    });
    await createAuditEntry({
      action: 'UPDATE',
      entityType: 'Organization',
      entityId: updated.id,
      ...getAuditContext(req),
      previousData: org,
      newData: updated,
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
    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    await prisma.user.updateMany({ where: { organizationId: id }, data: { organizationId: null } });
    await prisma.property.updateMany({ where: { organizationId: id }, data: { organizationId: null } });
    await prisma.organization.delete({ where: { id } });

    await createAuditEntry({
      action: 'DELETE',
      entityType: 'Organization',
      entityId: id,
      ...getAuditContext(req),
      previousData: org,
    });
    res.json({ message: 'Organization deleted' });
  }),
);

router.put(
  '/:id/users/:userId',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const orgId = (req.validatedParams as IdParam).id;
    const userId = parseInt(String(req.params.userId ?? ''), 10);
    if (isNaN(userId) || userId < 1) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await prisma.user.update({ where: { id: userId }, data: { organizationId: orgId } });
    res.json({ message: 'User assigned to organization' });
  }),
);

router.delete(
  '/:id/users/:userId',
  authenticateToken,
  authorizeRoles('ADMIN'),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const userId = parseInt(String(req.params.userId ?? ''), 10);
    if (isNaN(userId) || userId < 1) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    await prisma.user.update({ where: { id: userId }, data: { organizationId: null } });
    res.json({ message: 'User removed from organization' });
  }),
);

export default router;
