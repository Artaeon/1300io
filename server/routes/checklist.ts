import { Router } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { createAuditEntry, getAuditContext } from '../audit';
import {
  createCategorySchema,
  updateCategorySchema,
  createItemSchema,
  updateItemSchema,
  idParamSchema,
  validateBody,
  validateParams,
} from '../schemas';
import type { z } from 'zod';

const router = Router();

type CreateCategory = z.infer<typeof createCategorySchema>;
type UpdateCategory = z.infer<typeof updateCategorySchema>;
type CreateItem = z.infer<typeof createItemSchema>;
type UpdateItem = z.infer<typeof updateItemSchema>;
type IdParam = z.infer<typeof idParamSchema>;

router.get(
  '/categories',
  authenticateToken,
  asyncHandler(async (_req, res) => {
    const categories = await prisma.checklistCategory.findMany({
      orderBy: { sort_order: 'asc' },
      include: { items: { orderBy: { sort_order: 'asc' } } },
    });
    res.json(categories);
  }),
);

router.post(
  '/categories',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER'),
  validateBody(createCategorySchema),
  asyncHandler(async (req, res) => {
    const { name, sort_order } = req.validatedBody as CreateCategory;
    const category = await prisma.checklistCategory.create({
      data: { name, sort_order: sort_order ?? 0 },
    });
    await createAuditEntry({
      action: 'CREATE',
      entityType: 'ChecklistCategory',
      entityId: category.id,
      ...getAuditContext(req),
      newData: category,
    });
    res.status(201).json(category);
  }),
);

router.put(
  '/categories/:id',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER'),
  validateParams(idParamSchema),
  validateBody(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const category = await prisma.checklistCategory.findUnique({ where: { id } });
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const updated = await prisma.checklistCategory.update({
      where: { id },
      data: req.validatedBody as UpdateCategory,
    });
    await createAuditEntry({
      action: 'UPDATE',
      entityType: 'ChecklistCategory',
      entityId: updated.id,
      ...getAuditContext(req),
      previousData: category,
      newData: updated,
    });
    res.json(updated);
  }),
);

router.delete(
  '/categories/:id',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER'),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const category = await prisma.checklistCategory.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    await prisma.checklistItem.deleteMany({ where: { category_id: id } });
    await prisma.checklistCategory.delete({ where: { id } });

    await createAuditEntry({
      action: 'DELETE',
      entityType: 'ChecklistCategory',
      entityId: id,
      ...getAuditContext(req),
      previousData: category,
    });
    res.json({ message: 'Category deleted' });
  }),
);

router.post(
  '/items',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER'),
  validateBody(createItemSchema),
  asyncHandler(async (req, res) => {
    const { text, category_id, sort_order } = req.validatedBody as CreateItem;

    const category = await prisma.checklistCategory.findUnique({ where: { id: category_id } });
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const item = await prisma.checklistItem.create({
      data: { text, category_id, sort_order: sort_order ?? 0 },
    });
    await createAuditEntry({
      action: 'CREATE',
      entityType: 'ChecklistItem',
      entityId: item.id,
      ...getAuditContext(req),
      newData: item,
    });
    res.status(201).json(item);
  }),
);

router.put(
  '/items/:id',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER'),
  validateParams(idParamSchema),
  validateBody(updateItemSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const item = await prisma.checklistItem.findUnique({ where: { id } });
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    const updated = await prisma.checklistItem.update({
      where: { id },
      data: req.validatedBody as UpdateItem,
    });
    await createAuditEntry({
      action: 'UPDATE',
      entityType: 'ChecklistItem',
      entityId: updated.id,
      ...getAuditContext(req),
      previousData: item,
      newData: updated,
    });
    res.json(updated);
  }),
);

router.delete(
  '/items/:id',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER'),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const item = await prisma.checklistItem.findUnique({ where: { id } });
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    await prisma.checklistItem.delete({ where: { id } });
    await createAuditEntry({
      action: 'DELETE',
      entityType: 'ChecklistItem',
      entityId: id,
      ...getAuditContext(req),
      previousData: item,
    });
    res.json({ message: 'Item deleted' });
  }),
);

export default router;
