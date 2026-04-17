const express = require('express');
const prisma = require('../lib/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createAuditEntry, getAuditContext } = require('../audit');
const {
  createCategorySchema,
  updateCategorySchema,
  createItemSchema,
  updateItemSchema,
  idParamSchema,
  validateBody,
  validateParams,
} = require('../schemas');

const router = express.Router();

router.get('/categories', authenticateToken, asyncHandler(async (req, res) => {
  const categories = await prisma.checklistCategory.findMany({
    orderBy: { sort_order: 'asc' },
    include: { items: { orderBy: { sort_order: 'asc' } } },
  });
  res.json(categories);
}));

router.post('/categories', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateBody(createCategorySchema), asyncHandler(async (req, res) => {
  const { name, sort_order } = req.validatedBody;
  const category = await prisma.checklistCategory.create({
    data: { name, sort_order: sort_order ?? 0 },
  });
  await createAuditEntry({ action: 'CREATE', entityType: 'ChecklistCategory', entityId: category.id, ...getAuditContext(req), newData: category });
  res.status(201).json(category);
}));

router.put('/categories/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateParams(idParamSchema), validateBody(updateCategorySchema), asyncHandler(async (req, res) => {
  const category = await prisma.checklistCategory.findUnique({ where: { id: req.validatedParams.id } });
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const updated = await prisma.checklistCategory.update({
    where: { id: req.validatedParams.id },
    data: req.validatedBody,
  });
  await createAuditEntry({ action: 'UPDATE', entityType: 'ChecklistCategory', entityId: updated.id, ...getAuditContext(req), previousData: category, newData: updated });
  res.json(updated);
}));

router.delete('/categories/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const category = await prisma.checklistCategory.findUnique({ where: { id: req.validatedParams.id }, include: { items: true } });
  if (!category) return res.status(404).json({ error: 'Category not found' });

  await prisma.checklistItem.deleteMany({ where: { category_id: req.validatedParams.id } });
  await prisma.checklistCategory.delete({ where: { id: req.validatedParams.id } });

  await createAuditEntry({ action: 'DELETE', entityType: 'ChecklistCategory', entityId: req.validatedParams.id, ...getAuditContext(req), previousData: category });
  res.json({ message: 'Category deleted' });
}));

router.post('/items', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateBody(createItemSchema), asyncHandler(async (req, res) => {
  const { text, category_id, sort_order } = req.validatedBody;

  const category = await prisma.checklistCategory.findUnique({ where: { id: category_id } });
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const item = await prisma.checklistItem.create({
    data: { text, category_id, sort_order: sort_order ?? 0 },
  });
  await createAuditEntry({ action: 'CREATE', entityType: 'ChecklistItem', entityId: item.id, ...getAuditContext(req), newData: item });
  res.status(201).json(item);
}));

router.put('/items/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateParams(idParamSchema), validateBody(updateItemSchema), asyncHandler(async (req, res) => {
  const item = await prisma.checklistItem.findUnique({ where: { id: req.validatedParams.id } });
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const updated = await prisma.checklistItem.update({
    where: { id: req.validatedParams.id },
    data: req.validatedBody,
  });
  await createAuditEntry({ action: 'UPDATE', entityType: 'ChecklistItem', entityId: updated.id, ...getAuditContext(req), previousData: item, newData: updated });
  res.json(updated);
}));

router.delete('/items/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const item = await prisma.checklistItem.findUnique({ where: { id: req.validatedParams.id } });
  if (!item) return res.status(404).json({ error: 'Item not found' });

  await prisma.checklistItem.delete({ where: { id: req.validatedParams.id } });
  await createAuditEntry({ action: 'DELETE', entityType: 'ChecklistItem', entityId: req.validatedParams.id, ...getAuditContext(req), previousData: item });
  res.json({ message: 'Item deleted' });
}));

module.exports = router;
