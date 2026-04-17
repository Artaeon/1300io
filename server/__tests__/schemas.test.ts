import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  createPropertySchema,
  createInspectionSchema,
  inspectionResultSchema,
  idParamSchema,
} from '../schemas';

// A reusable password that satisfies the 12-char, mixed-case,
// digit-containing policy and isn't on the blocklist.
const STRONG_PASSWORD = 'Correct-Horse-Battery-42';

describe('Validation Schemas', () => {
  describe('registerSchema', () => {
    it('accepts valid registration data (with a policy-compliant password)', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: STRONG_PASSWORD,
        name: 'Test User',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        password: STRONG_PASSWORD,
        name: 'Test User',
      });
      expect(result.success).toBe(false);
    });

    it('rejects short password (below the 12-char floor)', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'Short1A',
        name: 'Test User',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: STRONG_PASSWORD,
        name: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects passwords that fail the policy even when >=12 chars', () => {
      // all-lowercase, no digit
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'allgoodlowercase',
        name: 'Test User',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('accepts valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'anypassword',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createPropertySchema', () => {
    it('accepts valid property data', () => {
      const result = createPropertySchema.safeParse({
        address: 'Musterstrasse 1, 1010 Wien',
        owner_name: 'Test GmbH',
        units_count: 12,
      });
      expect(result.success).toBe(true);
    });

    it('coerces string units_count to number', () => {
      const result = createPropertySchema.safeParse({
        address: 'Musterstrasse 1',
        owner_name: 'Test',
        units_count: '5',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.units_count).toBe(5);
      }
    });

    it('rejects negative units count', () => {
      const result = createPropertySchema.safeParse({
        address: 'Musterstrasse 1',
        owner_name: 'Test',
        units_count: -1,
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty address', () => {
      const result = createPropertySchema.safeParse({
        address: '',
        owner_name: 'Test',
        units_count: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createInspectionSchema', () => {
    it('accepts valid inspection data', () => {
      const result = createInspectionSchema.safeParse({
        propertyId: 1,
        inspectorName: 'Max Mustermann',
      });
      expect(result.success).toBe(true);
    });

    it('coerces string propertyId', () => {
      const result = createInspectionSchema.safeParse({
        propertyId: '1',
        inspectorName: 'Max',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.propertyId).toBe(1);
      }
    });
  });

  describe('inspectionResultSchema', () => {
    it('accepts valid result with OK status', () => {
      const result = inspectionResultSchema.safeParse({
        checklistItemId: 1,
        status: 'OK',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid result with DEFECT status and comment', () => {
      const result = inspectionResultSchema.safeParse({
        checklistItemId: 1,
        status: 'DEFECT',
        comment: 'Riss in der Fassade',
        photoUrl: '/uploads/photo.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('accepts NOT_APPLICABLE status', () => {
      const result = inspectionResultSchema.safeParse({
        checklistItemId: 1,
        status: 'NOT_APPLICABLE',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid status', () => {
      const result = inspectionResultSchema.safeParse({
        checklistItemId: 1,
        status: 'INVALID',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('idParamSchema', () => {
    it('accepts valid numeric id', () => {
      const result = idParamSchema.safeParse({ id: '5' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(5);
      }
    });

    it('rejects non-numeric id', () => {
      const result = idParamSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });

    it('rejects zero id', () => {
      const result = idParamSchema.safeParse({ id: '0' });
      expect(result.success).toBe(false);
    });
  });
});
