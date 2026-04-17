const express = require('express');
const prisma = require('../lib/prisma');
const logger = require('../logger');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { createAuditEntry, getAuditContext } = require('../audit');
const {
  createInspectionSchema,
  inspectionResultSchema,
  idParamSchema,
  validateBody,
  validateParams,
} = require('../schemas');

const router = express.Router();

router.get('/history', authenticateToken, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));

  const where = { status: 'COMPLETED' };

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
}));

router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'INSPECTOR'), validateBody(createInspectionSchema), asyncHandler(async (req, res) => {
  const { propertyId, inspectorName } = req.validatedBody;

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const inspection = await prisma.inspection.create({
    data: {
      property_id: propertyId,
      inspector_name: inspectorName,
      status: 'DRAFT',
    },
  });
  await createAuditEntry({ action: 'CREATE', entityType: 'Inspection', entityId: inspection.id, ...getAuditContext(req), newData: inspection });
  res.status(201).json(inspection);
}));

router.get('/:id', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id: req.validatedParams.id },
    include: { results: true },
  });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });
  res.json(inspection);
}));

router.get('/:id/results', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspection = await prisma.inspection.findUnique({ where: { id: req.validatedParams.id } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const results = await prisma.inspectionResult.findMany({
    where: { inspection_id: req.validatedParams.id },
  });
  res.json(results);
}));

router.post('/:id/results', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'INSPECTOR'), validateParams(idParamSchema), validateBody(inspectionResultSchema), asyncHandler(async (req, res) => {
  const inspectionId = req.validatedParams.id;
  const { checklistItemId, status, comment, photoUrl } = req.validatedBody;

  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });
  if (inspection.status !== 'DRAFT') return res.status(400).json({ error: 'Cannot modify a completed inspection' });

  const existingResult = await prisma.inspectionResult.findFirst({
    where: { inspection_id: inspectionId, checklist_item_id: checklistItemId },
  });

  let result;
  let isNew = false;

  if (existingResult) {
    result = await prisma.inspectionResult.update({
      where: { id: existingResult.id },
      data: { status, comment: comment || null, photo_url: photoUrl || null },
    });
    await createAuditEntry({ action: 'UPDATE', entityType: 'InspectionResult', entityId: result.id, ...getAuditContext(req), previousData: existingResult, newData: result });
  } else {
    result = await prisma.inspectionResult.create({
      data: {
        inspection_id: inspectionId,
        checklist_item_id: checklistItemId,
        status,
        comment: comment || null,
        photo_url: photoUrl || null,
      },
    });
    await createAuditEntry({ action: 'CREATE', entityType: 'InspectionResult', entityId: result.id, ...getAuditContext(req), newData: result });
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
}));

router.get('/:id/validate', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspectionId = req.validatedParams.id;

  const allItems = await prisma.checklistItem.findMany();
  const answeredResults = await prisma.inspectionResult.findMany({
    where: { inspection_id: inspectionId },
  });

  const answeredItemIds = new Set(answeredResults.map(r => r.checklist_item_id));
  const skippedItems = allItems.filter(item => !answeredItemIds.has(item.id));

  res.json({
    isComplete: skippedItems.length === 0,
    totalItems: allItems.length,
    answeredCount: answeredResults.length,
    skippedCount: skippedItems.length,
    skippedItems: skippedItems.map(item => ({ id: item.id, text: item.text })),
  });
}));

router.post('/:id/complete', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'INSPECTOR'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspectionId = req.validatedParams.id;

  const existing = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!existing) return res.status(404).json({ error: 'Inspection not found' });
  if (existing.status === 'COMPLETED') return res.status(400).json({ error: 'Inspection is already completed' });

  const inspection = await prisma.inspection.update({
    where: { id: inspectionId },
    data: { status: 'COMPLETED', ended_at: new Date() },
    include: { property: true },
  });

  await createAuditEntry({ action: 'UPDATE', entityType: 'Inspection', entityId: inspectionId, ...getAuditContext(req), previousData: { status: 'DRAFT' }, newData: { status: 'COMPLETED' } });
  logger.info('Inspection completed', { inspectionId, requestId: req.id });
  res.json(inspection);
}));

module.exports = router;
