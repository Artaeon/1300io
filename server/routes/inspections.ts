import { Router } from 'express';
import prisma from '../lib/prisma';
import logger from '../logger';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, authorizeRoles, canAccessOrg } from '../middleware/auth';
import { createAuditEntry, getAuditContext } from '../audit';
import {
  createInspectionSchema,
  inspectionResultSchema,
  idParamSchema,
  validateBody,
  validateParams,
} from '../schemas';
import type { z } from 'zod';

const router = Router();

type CreateInspection = z.infer<typeof createInspectionSchema>;
type InspectionResult = z.infer<typeof inspectionResultSchema>;
type IdParam = z.infer<typeof idParamSchema>;

async function loadInspectionWithOrg(id: number) {
  return prisma.inspection.findUnique({
    where: { id },
    include: { property: { select: { organizationId: true } } },
  });
}

router.get(
  '/history',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? ''), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? ''), 10) || 10));

    const isSuperAdmin = req.user?.role === 'ADMIN' && !req.user.organizationId;
    const where = {
      status: 'COMPLETED',
      ...(isSuperAdmin
        ? {}
        : { property: { organizationId: req.user?.organizationId ?? null } }),
    };

    const [total, inspections] = await Promise.all([
      prisma.inspection.count({ where }),
      prisma.inspection.findMany({
        where,
        orderBy: { ended_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          property: { select: { id: true, address: true } },
        },
      }),
    ]);

    res.json({ data: inspections, total, page, limit, totalPages: Math.ceil(total / limit) });
  }),
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER', 'INSPECTOR'),
  validateBody(createInspectionSchema),
  asyncHandler(async (req, res) => {
    const { propertyId, inspectorName } = req.validatedBody as CreateInspection;

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || !canAccessOrg(req.user, property.organizationId)) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const inspection = await prisma.inspection.create({
      data: {
        property_id: propertyId,
        inspector_name: inspectorName,
        status: 'DRAFT',
      },
    });
    await createAuditEntry({
      action: 'CREATE',
      entityType: 'Inspection',
      entityId: inspection.id,
      ...getAuditContext(req),
      newData: inspection,
    });
    res.status(201).json(inspection);
  }),
);

router.get(
  '/:id',
  authenticateToken,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const inspection = await prisma.inspection.findUnique({
      where: { id },
      include: { results: true, property: { select: { organizationId: true } } },
    });
    if (!inspection || !canAccessOrg(req.user, inspection.property?.organizationId)) {
      res.status(404).json({ error: 'Inspection not found' });
      return;
    }
    const { property: _p, ...rest } = inspection;
    res.json(rest);
  }),
);

router.get(
  '/:id/results',
  authenticateToken,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const inspection = await loadInspectionWithOrg(id);
    if (!inspection || !canAccessOrg(req.user, inspection.property?.organizationId)) {
      res.status(404).json({ error: 'Inspection not found' });
      return;
    }

    const results = await prisma.inspectionResult.findMany({
      where: { inspection_id: id },
    });
    res.json(results);
  }),
);

router.post(
  '/:id/results',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER', 'INSPECTOR'),
  validateParams(idParamSchema),
  validateBody(inspectionResultSchema),
  asyncHandler(async (req, res) => {
    const inspectionId = (req.validatedParams as IdParam).id;
    const { checklistItemId, status, comment, photoUrl } = req.validatedBody as InspectionResult;

    const inspection = await loadInspectionWithOrg(inspectionId);
    if (!inspection || !canAccessOrg(req.user, inspection.property?.organizationId)) {
      res.status(404).json({ error: 'Inspection not found' });
      return;
    }
    if (inspection.status !== 'DRAFT') {
      res.status(400).json({ error: 'Cannot modify a completed inspection' });
      return;
    }

    const existingResult = await prisma.inspectionResult.findFirst({
      where: { inspection_id: inspectionId, checklist_item_id: checklistItemId },
    });

    let result;
    let isNew = false;

    if (existingResult) {
      result = await prisma.inspectionResult.update({
        where: { id: existingResult.id },
        data: { status, comment: comment ?? null, photo_url: photoUrl ?? null },
      });
      await createAuditEntry({
        action: 'UPDATE',
        entityType: 'InspectionResult',
        entityId: result.id,
        ...getAuditContext(req),
        previousData: existingResult,
        newData: result,
      });
    } else {
      result = await prisma.inspectionResult.create({
        data: {
          inspection_id: inspectionId,
          checklist_item_id: checklistItemId,
          status,
          comment: comment ?? null,
          photo_url: photoUrl ?? null,
        },
      });
      await createAuditEntry({
        action: 'CREATE',
        entityType: 'InspectionResult',
        entityId: result.id,
        ...getAuditContext(req),
        newData: result,
      });
      isNew = true;
    }

    if (status === 'DEFECT') {
      const existingDefect = await prisma.defectTracking.findFirst({
        where: {
          property_id: inspection.property_id,
          checklist_item_id: checklistItemId,
          status: 'OPEN',
        },
      });
      if (!existingDefect) {
        await prisma.defectTracking.create({
          data: {
            property_id: inspection.property_id,
            checklist_item_id: checklistItemId,
            first_found_result_id: result.id,
            status: 'OPEN',
          },
        });
      }
    } else if (status === 'OK') {
      const openDefect = await prisma.defectTracking.findFirst({
        where: {
          property_id: inspection.property_id,
          checklist_item_id: checklistItemId,
          status: 'OPEN',
        },
      });
      if (openDefect) {
        await prisma.defectTracking.update({
          where: { id: openDefect.id },
          data: { status: 'RESOLVED', resolved_result_id: result.id },
        });
      }
    }

    res.status(isNew ? 201 : 200).json(result);
  }),
);

router.get(
  '/:id/validate',
  authenticateToken,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const inspectionId = (req.validatedParams as IdParam).id;
    const inspection = await loadInspectionWithOrg(inspectionId);
    if (!inspection || !canAccessOrg(req.user, inspection.property?.organizationId)) {
      res.status(404).json({ error: 'Inspection not found' });
      return;
    }

    const allItems = await prisma.checklistItem.findMany();
    const answeredResults = await prisma.inspectionResult.findMany({
      where: { inspection_id: inspectionId },
    });

    const answeredItemIds = new Set(answeredResults.map((r) => r.checklist_item_id));
    const skippedItems = allItems.filter((item) => !answeredItemIds.has(item.id));

    res.json({
      isComplete: skippedItems.length === 0,
      totalItems: allItems.length,
      answeredCount: answeredResults.length,
      skippedCount: skippedItems.length,
      skippedItems: skippedItems.map((item) => ({ id: item.id, text: item.text })),
    });
  }),
);

router.post(
  '/:id/complete',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER', 'INSPECTOR'),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const inspectionId = (req.validatedParams as IdParam).id;

    const existing = await loadInspectionWithOrg(inspectionId);
    if (!existing || !canAccessOrg(req.user, existing.property?.organizationId)) {
      res.status(404).json({ error: 'Inspection not found' });
      return;
    }
    if (existing.status === 'COMPLETED') {
      res.status(400).json({ error: 'Inspection is already completed' });
      return;
    }

    const inspection = await prisma.inspection.update({
      where: { id: inspectionId },
      data: { status: 'COMPLETED', ended_at: new Date() },
      include: { property: true },
    });

    await createAuditEntry({
      action: 'UPDATE',
      entityType: 'Inspection',
      entityId: inspectionId,
      ...getAuditContext(req),
      previousData: { status: 'DRAFT' },
      newData: { status: 'COMPLETED' },
    });
    logger.info('Inspection completed', { inspectionId, requestId: req.id });
    res.json(inspection);
  }),
);

// Delete a DRAFT inspection. Completed inspections are part of the
// audit trail and must not be deletable via this endpoint — a 409
// response makes that constraint explicit.
router.delete(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER', 'INSPECTOR'),
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const inspectionId = (req.validatedParams as IdParam).id;

    const existing = await loadInspectionWithOrg(inspectionId);
    if (!existing || !canAccessOrg(req.user, existing.property?.organizationId)) {
      res.status(404).json({ error: 'Inspection not found' });
      return;
    }
    if (existing.status !== 'DRAFT') {
      res.status(409).json({ error: 'Only draft inspections can be deleted' });
      return;
    }

    // Any DefectTracking rows that were auto-created by this draft
    // point at inspectionResults we're about to delete. Clear those
    // FK references first to avoid constraint violations, then drop
    // the inspection and its results together.
    await prisma.defectTracking.updateMany({
      where: {
        first_found_result: { inspection_id: inspectionId },
        status: 'OPEN',
      },
      data: { status: 'RESOLVED' },
    });
    await prisma.defectTracking.deleteMany({
      where: {
        OR: [
          { first_found_result: { inspection_id: inspectionId } },
          { resolved_result: { inspection_id: inspectionId } },
        ],
      },
    });
    await prisma.inspectionResult.deleteMany({ where: { inspection_id: inspectionId } });
    await prisma.inspection.delete({ where: { id: inspectionId } });

    await createAuditEntry({
      action: 'DELETE',
      entityType: 'Inspection',
      entityId: inspectionId,
      ...getAuditContext(req),
      previousData: { status: existing.status, propertyId: existing.property_id },
    });
    logger.info('Draft inspection deleted', { inspectionId, requestId: req.id });
    res.json({ message: 'Draft deleted' });
  }),
);

export default router;
