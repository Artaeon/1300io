const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

const logger = require('./logger');
const { config, validateConfig, isProduction } = require('./config');
const { asyncHandler, errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestId } = require('./middleware/requestId');
const { enforceHttps, securityHeaders } = require('./middleware/security');
const { originCheck } = require('./middleware/originCheck');
const { createAuditEntry, getAuditContext } = require('./audit');
const bcrypt = require('bcryptjs');
const {
  createPropertySchema,
  updatePropertySchema,
  createInspectionSchema,
  inspectionResultSchema,
  createUserSchema,
  updateUserSchema,
  createCategorySchema,
  updateCategorySchema,
  createItemSchema,
  updateItemSchema,
  createOrganizationSchema,
  updateOrganizationSchema,
  idParamSchema,
  validateBody,
  validateParams,
} = require('./schemas');

// Validate required config before anything else
validateConfig();

const app = express();
const prisma = new PrismaClient();

// Ensure uploads directory exists
const uploadDir = path.resolve(config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// --- Security middleware ---

// Trust one upstream proxy (nginx/LB); needed so req.ip + X-Forwarded-Proto
// reflect the real client. Keep this tight — 'true' trusts any hop count.
app.set('trust proxy', 1);

app.use(requestId);
app.use(enforceHttps);
app.use(securityHeaders());
app.disable('x-powered-by');

app.use(cors({
  origin: isProduction ? config.frontendUrl : true,
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 86400,
}));

app.use(originCheck);

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});
app.use(globalLimiter);

app.use(express.json({ limit: '1mb' }));

// Serve uploaded files (static)
app.use('/uploads', express.static(uploadDir));

// --- Multer setup with security ---

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
    cb(null, true);
  },
});

// --- Authentication middleware ---

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// --- Authorization middleware ---

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// --- Organization scoping middleware ---

const injectOrgFilter = async (req, res, next) => {
  if (!req.user) return next();
  // ADMIN users without an org see all data
  if (req.user.role === 'ADMIN' && !req.user.organizationId) {
    req.orgFilter = {};
    return next();
  }
  // Users with an org are scoped to it
  if (req.user.organizationId) {
    req.orgFilter = { organizationId: req.user.organizationId };
  } else {
    // Users without an org see unscoped data
    req.orgFilter = {};
  }
  next();
};

// --- Rate limiters for sensitive endpoints ---

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Upload rate limit exceeded. Please try again later.' },
});

const pdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'PDF generation rate limit exceeded. Please try again later.' },
});

// --- Routes ---

app.get('/', (req, res) => {
  res.json({ name: '1300.io API', status: 'running' });
});

// Health checks
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/readyz', asyncHandler(async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ready', db: 'connected' });
}));

// Legacy health endpoint
app.get('/health', asyncHandler(async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', db: 'connected' });
}));

// Auth routes (with login rate limiting)
const authRoutes = require('./routes/auth');
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);

// --- User Management (ADMIN only) ---

app.get('/api/users', authenticateToken, authorizeRoles('ADMIN'), asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, organizationId: true, createdAt: true, updatedAt: true }
  });
  res.json(users);
}));

app.post('/api/users', authenticateToken, authorizeRoles('ADMIN'), validateBody(createUserSchema), asyncHandler(async (req, res) => {
  const { email, password, name, role } = req.validatedBody;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name, role }
  });

  await createAuditEntry({ action: 'CREATE', entityType: 'User', entityId: user.id, ...getAuditContext(req), newData: { email, name, role } });
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt });
}));

app.put('/api/users/:id', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), validateBody(updateUserSchema), asyncHandler(async (req, res) => {
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
    select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true }
  });

  await createAuditEntry({ action: 'UPDATE', entityType: 'User', entityId: updated.id, ...getAuditContext(req), previousData: { email: user.email, name: user.name, role: user.role }, newData: { email: updated.email, name: updated.name, role: updated.role } });
  res.json(updated);
}));

app.delete('/api/users/:id', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.validatedParams.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Prevent self-delete
  if (user.id === req.user.userId) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: req.validatedParams.id } });

  await createAuditEntry({ action: 'DELETE', entityType: 'User', entityId: req.validatedParams.id, ...getAuditContext(req), previousData: { email: user.email, name: user.name, role: user.role } });
  res.json({ message: 'User deleted' });
}));

// --- Organizations (ADMIN only) ---

app.get('/api/organizations', authenticateToken, authorizeRoles('ADMIN'), asyncHandler(async (req, res) => {
  const orgs = await prisma.organization.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { users: true, properties: true } }
    }
  });
  res.json(orgs);
}));

app.post('/api/organizations', authenticateToken, authorizeRoles('ADMIN'), validateBody(createOrganizationSchema), asyncHandler(async (req, res) => {
  const { name } = req.validatedBody;
  const org = await prisma.organization.create({ data: { name } });
  await createAuditEntry({ action: 'CREATE', entityType: 'Organization', entityId: org.id, ...getAuditContext(req), newData: org });
  res.status(201).json(org);
}));

app.put('/api/organizations/:id', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), validateBody(updateOrganizationSchema), asyncHandler(async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.validatedParams.id } });
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const updated = await prisma.organization.update({
    where: { id: req.validatedParams.id },
    data: req.validatedBody
  });
  await createAuditEntry({ action: 'UPDATE', entityType: 'Organization', entityId: updated.id, ...getAuditContext(req), previousData: org, newData: updated });
  res.json(updated);
}));

app.delete('/api/organizations/:id', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const org = await prisma.organization.findUnique({ where: { id: req.validatedParams.id } });
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  // Unlink users and properties before deleting
  await prisma.user.updateMany({ where: { organizationId: req.validatedParams.id }, data: { organizationId: null } });
  await prisma.property.updateMany({ where: { organizationId: req.validatedParams.id }, data: { organizationId: null } });
  await prisma.organization.delete({ where: { id: req.validatedParams.id } });

  await createAuditEntry({ action: 'DELETE', entityType: 'Organization', entityId: req.validatedParams.id, ...getAuditContext(req), previousData: org });
  res.json({ message: 'Organization deleted' });
}));

// Assign user to organization
app.put('/api/organizations/:id/users/:userId', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
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

// Remove user from organization
app.delete('/api/organizations/:id/users/:userId', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId) || userId < 1) return res.status(400).json({ error: 'Invalid user ID' });

  await prisma.user.update({ where: { id: userId }, data: { organizationId: null } });
  res.json({ message: 'User removed from organization' });
}));

// --- Properties ---

app.get('/api/properties', authenticateToken, injectOrgFilter, asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const search = req.query.search?.trim() || '';

  const where = {
    ...req.orgFilter,
    ...(search ? {
      OR: [
        { address: { contains: search } },
        { owner_name: { contains: search } }
      ]
    } : {})
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
          select: { id: true, ended_at: true, inspector_name: true }
        }
      }
    })
  ]);

  const data = properties.map(p => ({
    ...p,
    lastInspection: p.inspections[0] || null,
    inspections: undefined
  }));

  res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

app.post('/api/properties', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateBody(createPropertySchema), asyncHandler(async (req, res) => {
  const { address, owner_name, units_count } = req.validatedBody;
  const property = await prisma.property.create({
    data: { address, owner_name, units_count, organizationId: req.user.organizationId || null }
  });
  await createAuditEntry({ action: 'CREATE', entityType: 'Property', entityId: property.id, ...getAuditContext(req), newData: property });
  res.status(201).json(property);
}));

app.get('/api/properties/:id', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({
    where: { id: req.validatedParams.id }
  });
  if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json(property);
}));

// Update property
app.put('/api/properties/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateParams(idParamSchema), validateBody(updatePropertySchema), asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({ where: { id: req.validatedParams.id } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const updated = await prisma.property.update({
    where: { id: req.validatedParams.id },
    data: req.validatedBody
  });

  await createAuditEntry({ action: 'UPDATE', entityType: 'Property', entityId: updated.id, ...getAuditContext(req), previousData: property, newData: updated });
  res.json(updated);
}));

// Delete property
app.delete('/api/properties/:id', authenticateToken, authorizeRoles('ADMIN'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({ where: { id: req.validatedParams.id } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  // Block if active draft inspections exist
  const activeDraft = await prisma.inspection.findFirst({
    where: { property_id: req.validatedParams.id, status: 'DRAFT' }
  });
  if (activeDraft) {
    return res.status(409).json({ error: 'Cannot delete property with active draft inspections' });
  }

  // Cascade delete: defects -> results -> inspections -> property
  await prisma.defectTracking.deleteMany({ where: { property_id: req.validatedParams.id } });
  await prisma.inspectionResult.deleteMany({
    where: { inspection: { property_id: req.validatedParams.id } }
  });
  await prisma.inspection.deleteMany({ where: { property_id: req.validatedParams.id } });
  await prisma.property.delete({ where: { id: req.validatedParams.id } });

  await createAuditEntry({ action: 'DELETE', entityType: 'Property', entityId: req.validatedParams.id, ...getAuditContext(req), previousData: property });
  res.json({ message: 'Property deleted' });
}));

// Check for existing draft inspection for a property
app.get('/api/properties/:id/draft-inspection', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const draft = await prisma.inspection.findFirst({
    where: { property_id: req.validatedParams.id, status: 'DRAFT' },
    orderBy: { createdAt: 'desc' },
  });
  res.json(draft);
}));

// --- QR Code ---

app.get('/api/properties/:id/qr', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({ where: { id: req.validatedParams.id } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const baseUrl = config.frontendUrl || `${req.protocol}://${req.get('host')}`;
  const inspectionUrl = `${baseUrl}/inspection/new/${property.id}`;

  const qrDataUrl = await QRCode.toDataURL(inspectionUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#1e3a5f' }
  });

  res.json({ qr: qrDataUrl, url: inspectionUrl });
}));

// --- Defect Tracking ---

app.get('/api/properties/:id/defects', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const property = await prisma.property.findUnique({ where: { id: req.validatedParams.id } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const defects = await prisma.defectTracking.findMany({
    where: { property_id: req.validatedParams.id },
    orderBy: { createdAt: 'desc' },
    include: {
      checklist_item: { include: { category: true } },
      first_found_result: { include: { inspection: { select: { id: true, date: true, inspector_name: true } } } },
      resolved_result: { include: { inspection: { select: { id: true, date: true, inspector_name: true } } } }
    }
  });

  res.json(defects);
}));

// --- Inspections ---

app.get('/api/inspections/history', authenticateToken, asyncHandler(async (req, res) => {
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
        property: { select: { id: true, address: true } }
      }
    })
  ]);

  res.json({ data: inspections, total, page, limit, totalPages: Math.ceil(total / limit) });
}));

app.post('/api/inspections', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'INSPECTOR'), validateBody(createInspectionSchema), asyncHandler(async (req, res) => {
  const { propertyId, inspectorName } = req.validatedBody;

  // Verify property exists
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return res.status(404).json({ error: 'Property not found' });

  const inspection = await prisma.inspection.create({
    data: {
      property_id: propertyId,
      inspector_name: inspectorName,
      status: 'DRAFT'
    }
  });
  await createAuditEntry({ action: 'CREATE', entityType: 'Inspection', entityId: inspection.id, ...getAuditContext(req), newData: inspection });
  res.status(201).json(inspection);
}));

app.get('/api/inspections/:id', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id: req.validatedParams.id },
    include: { results: true }
  });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });
  res.json(inspection);
}));

// Get results for an inspection (for draft resume)
app.get('/api/inspections/:id/results', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspection = await prisma.inspection.findUnique({ where: { id: req.validatedParams.id } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  const results = await prisma.inspectionResult.findMany({
    where: { inspection_id: req.validatedParams.id }
  });
  res.json(results);
}));

// Save single result (with defect tracking)
app.post('/api/inspections/:id/results', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'INSPECTOR'), validateParams(idParamSchema), validateBody(inspectionResultSchema), asyncHandler(async (req, res) => {
  const inspectionId = req.validatedParams.id;
  const { checklistItemId, status, comment, photoUrl } = req.validatedBody;

  // Verify inspection exists and is in DRAFT status
  const inspection = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });
  if (inspection.status !== 'DRAFT') return res.status(400).json({ error: 'Cannot modify a completed inspection' });

  const existingResult = await prisma.inspectionResult.findFirst({
    where: { inspection_id: inspectionId, checklist_item_id: checklistItemId }
  });

  let result;
  let isNew = false;

  if (existingResult) {
    result = await prisma.inspectionResult.update({
      where: { id: existingResult.id },
      data: { status, comment: comment || null, photo_url: photoUrl || null }
    });
    await createAuditEntry({ action: 'UPDATE', entityType: 'InspectionResult', entityId: result.id, ...getAuditContext(req), previousData: existingResult, newData: result });
  } else {
    result = await prisma.inspectionResult.create({
      data: {
        inspection_id: inspectionId,
        checklist_item_id: checklistItemId,
        status,
        comment: comment || null,
        photo_url: photoUrl || null
      }
    });
    await createAuditEntry({ action: 'CREATE', entityType: 'InspectionResult', entityId: result.id, ...getAuditContext(req), newData: result });
    isNew = true;
  }

  // --- Defect Tracking ---
  if (status === 'DEFECT') {
    // Auto-create DefectTracking if no OPEN defect exists for this property+item
    const existingDefect = await prisma.defectTracking.findFirst({
      where: {
        property_id: inspection.property_id,
        checklist_item_id: checklistItemId,
        status: 'OPEN'
      }
    });
    if (!existingDefect) {
      await prisma.defectTracking.create({
        data: {
          property_id: inspection.property_id,
          checklist_item_id: checklistItemId,
          first_found_result_id: result.id,
          status: 'OPEN'
        }
      });
    }
  } else if (status === 'OK') {
    // Auto-resolve any OPEN defect for this property+item
    const openDefect = await prisma.defectTracking.findFirst({
      where: {
        property_id: inspection.property_id,
        checklist_item_id: checklistItemId,
        status: 'OPEN'
      }
    });
    if (openDefect) {
      await prisma.defectTracking.update({
        where: { id: openDefect.id },
        data: { status: 'RESOLVED', resolved_result_id: result.id }
      });
    }
  }

  res.status(isNew ? 201 : 200).json(result);
}));

// Validate inspection completeness
app.get('/api/inspections/:id/validate', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspectionId = req.validatedParams.id;

  const allItems = await prisma.checklistItem.findMany();
  const answeredResults = await prisma.inspectionResult.findMany({
    where: { inspection_id: inspectionId }
  });

  const answeredItemIds = new Set(answeredResults.map(r => r.checklist_item_id));
  const skippedItems = allItems.filter(item => !answeredItemIds.has(item.id));

  res.json({
    isComplete: skippedItems.length === 0,
    totalItems: allItems.length,
    answeredCount: answeredResults.length,
    skippedCount: skippedItems.length,
    skippedItems: skippedItems.map(item => ({ id: item.id, text: item.text }))
  });
}));

// Complete inspection
app.post('/api/inspections/:id/complete', authenticateToken, authorizeRoles('ADMIN', 'MANAGER', 'INSPECTOR'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspectionId = req.validatedParams.id;

  const existing = await prisma.inspection.findUnique({ where: { id: inspectionId } });
  if (!existing) return res.status(404).json({ error: 'Inspection not found' });
  if (existing.status === 'COMPLETED') return res.status(400).json({ error: 'Inspection is already completed' });

  const inspection = await prisma.inspection.update({
    where: { id: inspectionId },
    data: { status: 'COMPLETED', ended_at: new Date() },
    include: { property: true }
  });

  await createAuditEntry({ action: 'UPDATE', entityType: 'Inspection', entityId: inspectionId, ...getAuditContext(req), previousData: { status: 'DRAFT' }, newData: { status: 'COMPLETED' } });
  logger.info('Inspection completed', { inspectionId });
  res.json(inspection);
}));

// --- Checklist ---

app.get('/api/checklist/categories', authenticateToken, asyncHandler(async (req, res) => {
  const categories = await prisma.checklistCategory.findMany({
    orderBy: { sort_order: 'asc' },
    include: { items: { orderBy: { sort_order: 'asc' } } }
  });
  res.json(categories);
}));

app.post('/api/checklist/categories', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateBody(createCategorySchema), asyncHandler(async (req, res) => {
  const { name, sort_order } = req.validatedBody;
  const category = await prisma.checklistCategory.create({
    data: { name, sort_order: sort_order ?? 0 }
  });
  await createAuditEntry({ action: 'CREATE', entityType: 'ChecklistCategory', entityId: category.id, ...getAuditContext(req), newData: category });
  res.status(201).json(category);
}));

app.put('/api/checklist/categories/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateParams(idParamSchema), validateBody(updateCategorySchema), asyncHandler(async (req, res) => {
  const category = await prisma.checklistCategory.findUnique({ where: { id: req.validatedParams.id } });
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const updated = await prisma.checklistCategory.update({
    where: { id: req.validatedParams.id },
    data: req.validatedBody
  });
  await createAuditEntry({ action: 'UPDATE', entityType: 'ChecklistCategory', entityId: updated.id, ...getAuditContext(req), previousData: category, newData: updated });
  res.json(updated);
}));

app.delete('/api/checklist/categories/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const category = await prisma.checklistCategory.findUnique({ where: { id: req.validatedParams.id }, include: { items: true } });
  if (!category) return res.status(404).json({ error: 'Category not found' });

  // Delete all items in the category first
  await prisma.checklistItem.deleteMany({ where: { category_id: req.validatedParams.id } });
  await prisma.checklistCategory.delete({ where: { id: req.validatedParams.id } });

  await createAuditEntry({ action: 'DELETE', entityType: 'ChecklistCategory', entityId: req.validatedParams.id, ...getAuditContext(req), previousData: category });
  res.json({ message: 'Category deleted' });
}));

app.post('/api/checklist/items', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateBody(createItemSchema), asyncHandler(async (req, res) => {
  const { text, category_id, sort_order } = req.validatedBody;

  const category = await prisma.checklistCategory.findUnique({ where: { id: category_id } });
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const item = await prisma.checklistItem.create({
    data: { text, category_id, sort_order: sort_order ?? 0 }
  });
  await createAuditEntry({ action: 'CREATE', entityType: 'ChecklistItem', entityId: item.id, ...getAuditContext(req), newData: item });
  res.status(201).json(item);
}));

app.put('/api/checklist/items/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateParams(idParamSchema), validateBody(updateItemSchema), asyncHandler(async (req, res) => {
  const item = await prisma.checklistItem.findUnique({ where: { id: req.validatedParams.id } });
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const updated = await prisma.checklistItem.update({
    where: { id: req.validatedParams.id },
    data: req.validatedBody
  });
  await createAuditEntry({ action: 'UPDATE', entityType: 'ChecklistItem', entityId: updated.id, ...getAuditContext(req), previousData: item, newData: updated });
  res.json(updated);
}));

app.delete('/api/checklist/items/:id', authenticateToken, authorizeRoles('ADMIN', 'MANAGER'), validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const item = await prisma.checklistItem.findUnique({ where: { id: req.validatedParams.id } });
  if (!item) return res.status(404).json({ error: 'Item not found' });

  await prisma.checklistItem.delete({ where: { id: req.validatedParams.id } });
  await createAuditEntry({ action: 'DELETE', entityType: 'ChecklistItem', entityId: req.validatedParams.id, ...getAuditContext(req), previousData: item });
  res.json({ message: 'Item deleted' });
}));

// --- File Upload ---

app.post('/api/upload', authenticateToken, uploadLimiter, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  const publicUrl = `/uploads/${req.file.filename}`;
  res.json({ url: publicUrl });
});

// --- CSV Export ---

app.get('/api/inspections/:id/export/csv', authenticateToken, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id: req.validatedParams.id },
    include: {
      property: true,
      results: {
        include: {
          checklist_item: { include: { category: true } }
        }
      }
    }
  });

  if (!inspection) return res.status(404).json({ error: 'Inspection not found' });

  // Build CSV
  const escapeCSV = (val) => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [
    ['Kategorie', 'Pruefpunkt', 'Status', 'Kommentar', 'Foto-URL'].join(',')
  ];

  inspection.results.forEach(r => {
    const status = r.status === 'OK' ? 'OK' : r.status === 'DEFECT' ? 'Mangel' : 'N/A';
    rows.push([
      escapeCSV(r.checklist_item?.category?.name),
      escapeCSV(r.checklist_item?.text),
      status,
      escapeCSV(r.comment),
      escapeCSV(r.photo_url)
    ].join(','));
  });

  const csv = rows.join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=Pruefbericht-${inspection.id}.csv`);
  res.send('\uFEFF' + csv); // BOM for Excel compatibility
}));

// --- PDF Report ---

app.get('/api/inspections/:id/pdf', authenticateToken, pdfLimiter, validateParams(idParamSchema), asyncHandler(async (req, res) => {
  const inspection = await prisma.inspection.findUnique({
    where: { id: req.validatedParams.id },
    include: {
      property: true,
      results: {
        include: {
          checklist_item: {
            include: { category: true }
          }
        }
      }
    }
  });

  if (!inspection) {
    return res.status(404).json({ error: 'Inspection not found' });
  }

  // Create PDF with A4 size
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Pruefbericht - ${inspection.property.address}`,
      Author: inspection.inspector_name
    }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=Pruefbericht-${inspection.id}.pdf`);
  doc.pipe(res);

  // ============ HEADER ============
  doc.rect(0, 0, 595, 120).fill('#1e3a5f');

  doc.fillColor('white')
    .fontSize(24)
    .font('Helvetica-Bold')
    .text('SICHERHEITSBEGEHUNG', 50, 35, { align: 'center' });

  doc.fontSize(14)
    .font('Helvetica')
    .text('nach ONORM B 1300', 50, 65, { align: 'center' });

  doc.fontSize(10)
    .text(`Bericht #${inspection.id}`, 50, 90, { align: 'center' });

  // ============ PROPERTY INFO BOX ============
  doc.fillColor('black');
  const infoY = 140;

  doc.rect(50, infoY, 495, 80).stroke('#ddd');

  doc.fontSize(10).font('Helvetica-Bold').text('OBJEKTDATEN', 60, infoY + 10);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Adresse: ${inspection.property.address}`, 60, infoY + 28);
  doc.text(`Eigentuemer: ${inspection.property.owner_name}`, 60, infoY + 43);
  doc.text(`Einheiten: ${inspection.property.units_count}`, 60, infoY + 58);

  doc.fontSize(10).font('Helvetica-Bold').text('PRUEFUNG', 350, infoY + 10);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Datum: ${new Date(inspection.date).toLocaleDateString('de-AT')}`, 350, infoY + 28);
  doc.text(`Pruefer: ${inspection.inspector_name}`, 350, infoY + 43);
  doc.text(`Status: ${inspection.status === 'COMPLETED' ? 'Abgeschlossen' : 'Entwurf'}`, 350, infoY + 58);

  // ============ SUMMARY STATISTICS ============
  const okCount = inspection.results.filter(r => r.status === 'OK').length;
  const defectCount = inspection.results.filter(r => r.status === 'DEFECT').length;
  const naCount = inspection.results.filter(r => r.status === 'NOT_APPLICABLE').length;

  const statsY = 240;
  doc.fontSize(12).font('Helvetica-Bold').text('ZUSAMMENFASSUNG', 50, statsY);

  const boxWidth = 150;
  const boxHeight = 50;
  const boxY = statsY + 20;

  // OK Box
  doc.rect(50, boxY, boxWidth, boxHeight).fill('#d4edda');
  doc.fillColor('#155724').fontSize(20).font('Helvetica-Bold').text(String(okCount), 50, boxY + 8, { width: boxWidth, align: 'center' });
  doc.fontSize(10).font('Helvetica').text('OK', 50, boxY + 32, { width: boxWidth, align: 'center' });

  // Defect Box
  doc.rect(220, boxY, boxWidth, boxHeight).fill('#f8d7da');
  doc.fillColor('#721c24').fontSize(20).font('Helvetica-Bold').text(String(defectCount), 220, boxY + 8, { width: boxWidth, align: 'center' });
  doc.fontSize(10).font('Helvetica').text('Maengel', 220, boxY + 32, { width: boxWidth, align: 'center' });

  // N/A Box
  doc.rect(390, boxY, 155, boxHeight).fill('#e2e3e5');
  doc.fillColor('#383d41').fontSize(20).font('Helvetica-Bold').text(String(naCount), 390, boxY + 8, { width: 155, align: 'center' });
  doc.fontSize(10).font('Helvetica').text('Nicht anwendbar', 390, boxY + 32, { width: 155, align: 'center' });

  // ============ RESULTS BY CATEGORY ============
  doc.fillColor('black');
  let currentY = 340;

  const resultsByCategory = {};
  inspection.results.forEach(result => {
    if (result.checklist_item && result.checklist_item.category) {
      const catName = result.checklist_item.category.name;
      if (!resultsByCategory[catName]) {
        resultsByCategory[catName] = [];
      }
      resultsByCategory[catName].push(result);
    }
  });

  doc.fontSize(12).font('Helvetica-Bold').text('PRUEFERGEBNISSE', 50, currentY);
  currentY += 25;

  const drawTableHeader = (y) => {
    doc.rect(50, y, 495, 20).fill('#f0f0f0');
    doc.fillColor('black').fontSize(9).font('Helvetica-Bold');
    doc.text('Pruefpunkt', 55, y + 5, { width: 350 });
    doc.text('Status', 420, y + 5, { width: 80 });
    return y + 20;
  };

  Object.entries(resultsByCategory).forEach(([categoryName, results]) => {
    if (currentY > 700) {
      doc.addPage();
      currentY = 50;
    }

    doc.rect(50, currentY, 495, 22).fill('#1e3a5f');
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
      .text(categoryName.toUpperCase(), 55, currentY + 6);
    currentY += 22;

    currentY = drawTableHeader(currentY);

    results.forEach((result, index) => {
      if (currentY > 750) {
        doc.addPage();
        currentY = 50;
        currentY = drawTableHeader(currentY);
      }

      const bgColor = index % 2 === 0 ? '#ffffff' : '#fafafa';
      doc.rect(50, currentY, 495, 18).fill(bgColor);

      doc.fillColor('black').fontSize(9).font('Helvetica');
      doc.text(result.checklist_item.text, 55, currentY + 4, { width: 350 });

      let statusText = result.status;
      let statusColor = '#333';
      if (result.status === 'OK') {
        statusText = 'OK';
        statusColor = '#155724';
      } else if (result.status === 'DEFECT') {
        statusText = 'Mangel';
        statusColor = '#721c24';
      } else {
        statusText = 'N/A';
        statusColor = '#6c757d';
      }

      doc.fillColor(statusColor).font('Helvetica-Bold')
        .text(statusText, 420, currentY + 4, { width: 80 });

      currentY += 18;
    });

    currentY += 10;
  });

  // ============ DEFECTS DETAIL SECTION ============
  const defects = inspection.results.filter(r => r.status === 'DEFECT');

  if (defects.length > 0) {
    doc.addPage();

    doc.rect(0, 0, 595, 60).fill('#721c24');
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
      .text('MAENGELBERICHT', 50, 20, { align: 'center' });
    doc.fontSize(12).font('Helvetica')
      .text(`${defects.length} Mangel/Maengel dokumentiert`, 50, 42, { align: 'center' });

    doc.fillColor('black');
    let defectY = 80;

    defects.forEach((defect, index) => {
      if (defectY > 650) {
        doc.addPage();
        defectY = 50;
      }

      doc.rect(50, defectY, 495, 5).fill('#721c24');
      defectY += 10;

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#721c24')
        .text(`Mangel #${index + 1}`, 50, defectY);
      defectY += 18;

      doc.fontSize(10).font('Helvetica').fillColor('black')
        .text(`Kategorie: ${defect.checklist_item.category.name}`, 50, defectY);
      defectY += 15;

      doc.font('Helvetica-Bold').text(`Pruefpunkt: ${defect.checklist_item.text}`, 50, defectY);
      defectY += 18;

      if (defect.comment) {
        doc.font('Helvetica').text(`Anmerkung: ${defect.comment}`, 50, defectY, { width: 495 });
        defectY += doc.heightOfString(defect.comment, { width: 495 }) + 10;
      }

      // Photo -- only allow images from the uploads directory (path traversal protection)
      if (defect.photo_url) {
        const safePath = path.resolve(uploadDir, path.basename(defect.photo_url));
        if (safePath.startsWith(uploadDir) && fs.existsSync(safePath)) {
          try {
            if (defectY > 500) {
              doc.addPage();
              defectY = 50;
            }
            doc.image(safePath, 50, defectY, { width: 250 });
            defectY += 200;
            doc.fontSize(8).fillColor('#666')
              .text('Foto des Mangels', 50, defectY);
            defectY += 15;
          } catch (imgError) {
            logger.error('Error embedding image in PDF', { inspectionId: inspection.id, error: imgError.message });
            doc.fontSize(10).fillColor('#999')
              .text('[Bild konnte nicht geladen werden]', 50, defectY);
            defectY += 15;
          }
        }
      }

      doc.fillColor('black');
      defectY += 20;
    });
  }

  // ============ SIGNATURE SECTION ============
  doc.addPage();

  doc.fontSize(14).font('Helvetica-Bold').text('UNTERSCHRIFTEN', 50, 50);
  doc.moveDown(2);

  doc.fontSize(10).font('Helvetica').text('Pruefer:', 50, 100);
  doc.moveTo(50, 160).lineTo(250, 160).stroke();
  doc.fontSize(9).text(inspection.inspector_name, 50, 165);
  doc.text('Datum: ' + new Date().toLocaleDateString('de-AT'), 50, 180);

  doc.text('Auftraggeber / Eigentuemer:', 300, 100);
  doc.moveTo(300, 160).lineTo(500, 160).stroke();
  doc.text('Name: _______________________', 300, 165);
  doc.text('Datum: _______________________', 300, 180);

  // Footer
  doc.fontSize(8).fillColor('#999')
    .text(`Generiert am ${new Date().toLocaleString('de-AT')} | 1300.io v1.0`, 50, 750, { align: 'center' });

  doc.end();
  logger.info('PDF report generated', { inspectionId: inspection.id });
}));

// --- 404 catch-all (must come after all routes, before errorHandler) ---
app.use(notFoundHandler);

// --- Error handler (must be last) ---
app.use(errorHandler);

// --- Start server ---
app.listen(config.port, () => {
  logger.info(`1300.io API running on port ${config.port} (${config.nodeEnv})`);
});

module.exports = app;
