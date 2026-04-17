import { Router } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();

// GET /api/audit-logs — paginated list, ADMIN-only.
// Query params:
//   page, limit (default 1 / 20, max 100)
//   entityType (optional exact match)
//   action (CREATE | UPDATE | DELETE, optional)
//   userId (optional)
//
// Response includes decoded previousData/newData (they're stored as
// JSON strings) so the UI doesn't have to JSON.parse each row.
router.get(
  '/',
  authenticateToken,
  authorizeRoles('ADMIN'),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(String(req.query.page ?? ''), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? ''), 10) || 20));

    const where: Record<string, unknown> = {};
    if (typeof req.query.entityType === 'string' && req.query.entityType) {
      where.entityType = req.query.entityType;
    }
    if (typeof req.query.action === 'string' && ['CREATE', 'UPDATE', 'DELETE'].includes(req.query.action)) {
      where.action = req.query.action;
    }
    if (typeof req.query.userId === 'string' && req.query.userId) {
      const parsed = parseInt(req.query.userId, 10);
      if (!Number.isNaN(parsed)) where.userId = parsed;
    }

    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const data = rows.map((r) => ({
      ...r,
      previousData: r.previousData ? safeJson(r.previousData) : null,
      newData: r.newData ? safeJson(r.newData) : null,
    }));

    res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  }),
);

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export default router;
