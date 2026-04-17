import { Router } from 'express';
import QRCode from 'qrcode';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import {
  authenticateToken,
  authorizeRoles,
  injectOrgFilter,
  canAccessOrg,
} from '../middleware/auth';
import { createAuditEntry, getAuditContext } from '../audit';
import { config } from '../config';
import {
  createPropertySchema,
  updatePropertySchema,
  idParamSchema,
  validateBody,
  validateParams,
} from '../schemas';
import type { z } from 'zod';
import type { Prisma } from '@prisma/client';

const router = Router();

type CreateProperty = z.infer<typeof createPropertySchema>;
type UpdateProperty = z.infer<typeof updatePropertySchema>;
type IdParam = z.infer<typeof idParamSchema>;

router.get(
  '/',
  authenticateToken,
  injectOrgFilter,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? ''), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? ''), 10) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    const where: Prisma.PropertyWhereInput = {
      ...(req.orgFilter ?? {}),
      ...(search
        ? {
            OR: [
              { address: { contains: search } },
              { owner_name: { contains: search } },
            ],
          }
        : {}),
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

    const data = properties.map((p) => {
      const { inspections, ...rest } = p;
      return { ...rest, lastInspection: inspections[0] ?? null };
    });

    res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  }),
);

router.post(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER'),
  validateBody(createPropertySchema),
  asyncHandler(async (req, res) => {
    const { address, owner_name, units_count } = req.validatedBody as CreateProperty;
    const property = await prisma.property.create({
      data: {
        address,
        owner_name,
        units_count,
        organizationId: req.user?.organizationId ?? null,
      },
    });
    await createAuditEntry({
      action: 'CREATE',
      entityType: 'Property',
      entityId: property.id,
      ...getAuditContext(req),
      newData: property,
    });
    res.status(201).json(property);
  }),
);

router.get(
  '/:id',
  authenticateToken,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property || !canAccessOrg(req.user, property.organizationId)) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }
    res.json(property);
  }),
);

router.put(
  '/:id',
  authenticateToken,
  authorizeRoles('ADMIN', 'MANAGER'),
  validateParams(idParamSchema),
  validateBody(updatePropertySchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property || !canAccessOrg(req.user, property.organizationId)) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const updated = await prisma.property.update({
      where: { id },
      data: req.validatedBody as UpdateProperty,
    });

    await createAuditEntry({
      action: 'UPDATE',
      entityType: 'Property',
      entityId: updated.id,
      ...getAuditContext(req),
      previousData: property,
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
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property || !canAccessOrg(req.user, property.organizationId)) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const activeDraft = await prisma.inspection.findFirst({
      where: { property_id: id, status: 'DRAFT' },
    });
    if (activeDraft) {
      res.status(409).json({ error: 'Cannot delete property with active draft inspections' });
      return;
    }

    await prisma.defectTracking.deleteMany({ where: { property_id: id } });
    await prisma.inspectionResult.deleteMany({
      where: { inspection: { property_id: id } },
    });
    await prisma.inspection.deleteMany({ where: { property_id: id } });
    await prisma.property.delete({ where: { id } });

    await createAuditEntry({
      action: 'DELETE',
      entityType: 'Property',
      entityId: id,
      ...getAuditContext(req),
      previousData: property,
    });
    res.json({ message: 'Property deleted' });
  }),
);

router.get(
  '/:id/draft-inspection',
  authenticateToken,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const property = await prisma.property.findUnique({
      where: { id },
      select: { organizationId: true },
    });
    if (!property || !canAccessOrg(req.user, property.organizationId)) {
      res.json(null);
      return;
    }
    const draft = await prisma.inspection.findFirst({
      where: { property_id: id, status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
    });
    res.json(draft);
  }),
);

router.get(
  '/:id/qr',
  authenticateToken,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property || !canAccessOrg(req.user, property.organizationId)) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const baseUrl = config.frontendUrl || `${req.protocol}://${req.get('host')}`;
    const inspectionUrl = `${baseUrl}/inspection/new/${property.id}`;

    const qrDataUrl = await QRCode.toDataURL(inspectionUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#1e3a5f' },
    });

    res.json({ qr: qrDataUrl, url: inspectionUrl });
  }),
);

router.get(
  '/:id/defects',
  authenticateToken,
  validateParams(idParamSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.validatedParams as IdParam;
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property || !canAccessOrg(req.user, property.organizationId)) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const defects = await prisma.defectTracking.findMany({
      where: { property_id: id },
      orderBy: { createdAt: 'desc' },
      include: {
        checklist_item: { include: { category: true } },
        first_found_result: {
          include: { inspection: { select: { id: true, date: true, inspector_name: true } } },
        },
        resolved_result: {
          include: { inspection: { select: { id: true, date: true, inspector_name: true } } },
        },
      },
    });

    res.json(defects);
  }),
);

export default router;
