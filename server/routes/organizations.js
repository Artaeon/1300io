const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createAuditEntry, getAuditContext } = require('../audit');
const {
  createOrganizationSchema,
  updateOrganizationSchema,
  idParamSchema,
  validateBody,
  validateParams,
} = require('../schemas');

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('ADMIN'), asyncHandler(async (req, res) => {
  const orgs = await prisma.organization.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { users: true, properties: true } },
    },
  });
  res.json(orgs);
}));

router.post('/', authenticateToken, authorizeRoles('ADMIN'), validateBody(createOrganizationSchema), asyncHandler(async (req, res) => {
  const { name } = req.validatedBody;
  const org = await prisma.organization.create({ data: { name } });
  await createAuditEntry({ action: 'CREATE', entityType: 'Organization', entityId: org.id, ...getAuditContext(req), newData: org });
  res.status(201).json(org);
}));

router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), validateBody(updateOrganizationSchema), asyncHandler(async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.validatedParams.id } });
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const updated = await prisma.organization.update({
    where: { id: req.validatedParams.id },
    data: req.validatedBody,
  });
  await createAuditEntry({ action: 'UPDATE', entityType: 'Organization', entityId: updated.id, ...getAuditContext(req), previousData: org, newData: updated });
  res.json(updated);
}));

router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.validatedParams.id } });
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  await prisma.user.updateMany({ where: { organizationId: req.validatedParams.id }, data: { organizationId: null } });
  await prisma.property.updateMany({ where: { organizationId: req.validatedParams.id }, data: { organizationId: null } });
  await prisma.organization.delete({ where: { id: req.validatedParams.id } });

  await createAuditEntry({ action: 'DELETE', entityType: 'Organization', entityId: req.validatedParams.id, ...getAuditContext(req), previousData: org });
  res.json({ message: 'Organization deleted' });
}));

router.put('/:id/users/:userId', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const orgId = req.validatedParams.id;
  const userId = parseInt(req.params.userId);
  if (isNaN(userId) || userId < 1) return res.status(400).json({ error: 'Invalid user ID' });

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  await prisma.user.update({ where: { id: userId }, data: { organizationId: orgId } });
  res.json({ message: 'User assigned to organization' });
}));

router.delete('/:id/users/:userId', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId) || userId < 1) return res.status(400).json({ error: 'Invalid user ID' });

  await prisma.user.update({ where: { id: userId }, data: { organizationId: null } });
  res.json({ message: 'User removed from organization' });
}));

module.exports = router;
