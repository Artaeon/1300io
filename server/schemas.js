const { z } = require('zod');

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(200),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const createPropertySchema = z.object({
  address: z.string().min(1, 'Address is required').max(500),
  owner_name: z.string().min(1, 'Owner name is required').max(200),
  units_count: z.coerce.number().int().positive('Units count must be a positive integer'),
});

const createInspectionSchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  inspectorName: z.string().min(1, 'Inspector name is required').max(200),
});

const inspectionResultSchema = z.object({
  checklistItemId: z.number().int().positive(),
  status: z.enum(['OK', 'DEFECT', 'NOT_APPLICABLE'], {
    errorMap: () => ({ message: 'Status must be OK, DEFECT, or NOT_APPLICABLE' }),
  }),
  comment: z.string().max(2000).optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable(),
});

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Middleware factory for request body validation
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(i => i.message);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    req.validatedBody = result.data;
    next();
  };
}

// Middleware factory for URL params validation
function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    req.validatedParams = result.data;
    next();
  };
}

module.exports = {
  registerSchema,
  loginSchema,
  createPropertySchema,
  createInspectionSchema,
  inspectionResultSchema,
  idParamSchema,
  validateBody,
  validateParams,
};
