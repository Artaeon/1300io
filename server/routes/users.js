const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createAuditEntry, getAuditContext } = require('../audit');
const {
  createUserSchema,
  updateUserSchema,
  idParamSchema,
  validateBody,
  validateParams,
} = require('../schemas');

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles('ADMIN'), asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, organizationId: true, createdAt: true, updatedAt: true },
  });
  res.json(users);
}));

router.post('/', authenticateToken, authorizeRoles('ADMIN'), validateBody(createUserSchema), asyncHandler(async (req, res) => {
  const { email, password, name, role } = req.validatedBody;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name, role },
  });

  await createAuditEntry({ action: 'CREATE', entityType: 'User', entityId: user.id, ...getAuditContext(req), newData: { email, name, role } });
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt });
}));

router.put('/:id', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), validateBody(updateUserSchema), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.validatedParams.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const data = { ...req.validatedBody };
  if (data.password) {
    data.password = await bcrypt.hash(data.password, 12);
  }

  if (data.email && data.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(409).json({ error: 'Email already in use' });
  }

  const updated = await prisma.user.update({
    where: { id: req.validatedParams.id },
    data,
    select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true },
  });

  await createAuditEntry({
    action: 'UPDATE', entityType: 'User', entityId: updated.id, ...getAuditContext(req),
    previousData: { email: user.email, name: user.name, role: user.role },
    newData: { email: updated.email, name: updated.name, role: updated.role },
  });
  res.json(updated);
}));

router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.validatedParams.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.id === req.user.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: req.validatedParams.id } });

  await createAuditEntry({
    action: 'DELETE', entityType: 'User', entityId: req.validatedParams.id, ...getAuditContext(req),
    previousData: { email: user.email, name: user.name, role: user.role },
  });
  res.json({ message: 'User deleted' });
}));

module.exports = router;
