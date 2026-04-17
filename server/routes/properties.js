const express = require('express');
const QRCode = require('qrcode');
const prisma = require('../lib/prisma');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateToken, authorizeRoles, injectOrgFilter } = require('../middleware/auth');
const { createAuditEntry, getAuditContext } = require('../audit');
const { config } = require('../config');
const {
  createPropertySchema,
  updatePropertySchema,
  idParamSchema,
  validateBody,
  validateParams,
} = require('../schemas');

const router = express.Router();

router.get('/', authenticateToken, injectOrgFilter, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const search = req.query.search?.trim() || '';

  const where = {
    ...req.orgFilter,
    ...(search ? {
      OR: [
        { address: { contains: search } },
        { owner_name: { contains: search } },
      ],
    } : {}),
  };

  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        inspections: {
          where: { status: 'COMPLETED' },
          orderBy: { ended_at: 'desc' },
          take: 1,
          select: { id: true, ended_at: true, inspector_name: true },
        },
      },
    }),
  ]);

  const data = properties.map(p => ({
    ...p,
    lastInspection: p.inspections[0] || null,
    inspections: undefined,
  }));

  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

router.post('/', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateBody(createPropertySchema), asyncHandler(async (req, res) => {
  const { address, owner_name, units_count } = req.validatedBody;
  const property = await prisma.property.create({
    data: { address, owner_name, units_count, organizationId: req.user.organizationId || null },
  });
  await createAuditEntry({ action: 'CREATE', entityType: 'Property', entityId: property.id, ...getAuditContext(req), newData: property });
  res.status(201).json(property);
}));

router.get('/:id', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({
    where: { id: req.validatedParams.id },
  });
  if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json(property);
}));

router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateParams(idParamSchema), validateBody(updatePropertySchema), asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({ where: { id: req.validatedParams.id } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const updated = await prisma.property.update({
    where: { id: req.validatedParams.id },
    data: req.validatedBody,
  });

  await createAuditEntry({ action: 'UPDATE', entityType: 'Property', entityId: updated.id, ...getAuditContext(req), previousData: property, newData: updated });
  res.json(updated);
}));

router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({ where: { id: req.validatedParams.id } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const activeDraft = await prisma.inspection.findFirst({
    where: { property_id: req.validatedParams.id, status: 'DRAFT' },
  });
  if (activeDraft) {
    return res.status(409).json({ error: 'Cannot delete property with active draft inspections' });
  }

  await prisma.defectTracking.deleteMany({ where: { property_id: req.validatedParams.id } });
  await prisma.inspectionResult.deleteMany({
    where: { inspection: { property_id: req.validatedParams.id } },
  });
  await prisma.inspection.deleteMany({ where: { property_id: req.validatedParams.id } });
  await prisma.property.delete({ where: { id: req.validatedParams.id } });

  await createAuditEntry({ action: 'DELETE', entityType: 'Property', entityId: req.validatedParams.id, ...getAuditContext(req), previousData: property });
  res.json({ message: 'Property deleted' });
}));

router.get('/:id/draft-inspection', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const draft = await prisma.inspection.findFirst({
    where: { property_id: req.validatedParams.id, status: 'DRAFT' },
    orderBy: { createdAt: 'desc' },
  });
  res.json(draft);
}));

router.get('/:id/qr', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({ where: { id: req.validatedParams.id } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const baseUrl = config.frontendUrl || `${req.protocol}://${req.get('host')}`;
  const inspectionUrl = `${baseUrl}/inspection/new/${property.id}`;

  const qrDataUrl = await QRCode.toDataURL(inspectionUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#1e3a5f' },
  });

  res.json({ qr: qrDataUrl, url: inspectionUrl });
}));

router.get('/:id/defects', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({ where: { id: req.validatedParams.id } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const defects = await prisma.defectTracking.findMany({
    where: { property_id: req.validatedParams.id },
    orderBy: { createdAt: 'desc' },
    include: {
      checklist_item: { include: { category: true } },
      first_found_result: { include: { inspection: { select: { id: true, date: true, inspector_name: true } } } },
      resolved_result: { include: { inspection: { select: { id: true, date: true, inspector_name: true } } } },
    },
  });

  res.json(defects);
}));

module.exports = router;
