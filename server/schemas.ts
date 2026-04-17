import { z, type ZodType } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import { checkPasswordPolicy, passwordPolicyMin } from './lib/passwordPolicy';

// Enforce the project's password policy (length + complexity + weak-list).
// Refinement runs after min() so the min() message stays actionable
// when the user typed something too short.
const strongPassword = z
  .string()
  .min(passwordPolicyMin, `Passwort muss mindestens ${passwordPolicyMin} Zeichen lang sein`)
  .superRefine((pw, ctx) => {
    const result = checkPasswordPolicy(pw);
    if (!result.ok) {
      for (const reason of result.reasons) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: reason });
      }
    }
  });

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: strongPassword,
  name: z.string().min(1, 'Name is required').max(200),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const createPropertySchema = z.object({
  address: z.string().min(1, 'Address is required').max(500),
  owner_name: z.string().min(1, 'Owner name is required').max(200),
  units_count: z.coerce.number().int().positive('Units count must be a positive integer'),
});

export const updatePropertySchema = z
  .object({
    address: z.string().min(1).max(500).optional(),
    owner_name: z.string().min(1).max(200).optional(),
    units_count: z.coerce.number().int().positive().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' });

export const createInspectionSchema = z.object({
  propertyId: z.coerce.number().int().positive(),
  inspectorName: z.string().min(1, 'Inspector name is required').max(200),
});

export const inspectionResultSchema = z.object({
  checklistItemId: z.number().int().positive(),
  status: z.enum(['OK', 'DEFECT', 'NOT_APPLICABLE'], {
    message: 'Status must be OK, DEFECT, or NOT_APPLICABLE',
  }),
  comment: z.string().max(2000).optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable(),
});

const VALID_ROLES = ['ADMIN', 'MANAGER', 'INSPECTOR', 'READONLY'] as const;

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: strongPassword,
  name: z.string().min(1, 'Name is required').max(200),
  role: z.enum(VALID_ROLES, {
    message: `Role must be one of: ${VALID_ROLES.join(', ')}`,
  }),
});

export const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    password: strongPassword.optional(),
    name: z.string().min(1).max(200).optional(),
    role: z.enum(VALID_ROLES).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' });

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(200),
  sort_order: z.coerce.number().int().min(0).optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    sort_order: z.coerce.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' });

export const createItemSchema = z.object({
  text: z.string().min(1, 'Item text is required').max(500),
  category_id: z.coerce.number().int().positive(),
  sort_order: z.coerce.number().int().min(0).optional(),
});

export const updateItemSchema = z
  .object({
    text: z.string().min(1).max(500).optional(),
    sort_order: z.coerce.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' });

export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(200),
});

export const updateOrganizationSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' });

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

declare module 'express-serve-static-core' {
  interface Request {
    validatedBody?: unknown;
    validatedParams?: unknown;
  }
}

export function validateBody<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map((i) => i.message);
      res.status(400).json({ error: 'Validation failed', details: errors, requestId: req.id });
      return;
    }
    req.validatedBody = result.data;
    next();
  };
}

export function validateParams<T>(schema: ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      res.status(400).json({ error: 'Invalid parameters', requestId: req.id });
      return;
    }
    req.validatedParams = result.data;
    next();
  };
}
