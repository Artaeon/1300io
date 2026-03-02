const {
  registerSchema,
  loginSchema,
  createPropertySchema,
  createInspectionSchema,
  inspectionResultSchema,
  idParamSchema,
} = require('../schemas');

describe('Validation Schemas', () => {
  describe('registerSchema', () => {
    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'securepassword123',
        name: 'Test User',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = registerSchema.safeParse({
        email: 'not-an-email',
        password: 'securepassword123',
        name: 'Test User',
      });
      expect(result.success).toBe(false);
    });

    it('should reject short password', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: '123',
        name: 'Test User',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty name', () => {
      const result = registerSchema.safeParse({
        email: 'test@example.com',
        password: 'securepassword123',
        name: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'anypassword',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createPropertySchema', () => {
    it('should accept valid property data', () => {
      const result = createPropertySchema.safeParse({
        address: 'Musterstrasse 1, 1010 Wien',
        owner_name: 'Test GmbH',
        units_count: 12,
      });
      expect(result.success).toBe(true);
    });

    it('should coerce string units_count to number', () => {
      const result = createPropertySchema.safeParse({
        address: 'Musterstrasse 1',
        owner_name: 'Test',
        units_count: '5',
      });
      expect(result.success).toBe(true);
      expect(result.data.units_count).toBe(5);
    });

    it('should reject negative units count', () => {
      const result = createPropertySchema.safeParse({
        address: 'Musterstrasse 1',
        owner_name: 'Test',
        units_count: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty address', () => {
      const result = createPropertySchema.safeParse({
        address: '',
        owner_name: 'Test',
        units_count: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('createInspectionSchema', () => {
    it('should accept valid inspection data', () => {
      const result = createInspectionSchema.safeParse({
        propertyId: 1,
        inspectorName: 'Max Mustermann',
      });
      expect(result.success).toBe(true);
    });

    it('should coerce string propertyId', () => {
      const result = createInspectionSchema.safeParse({
        propertyId: '1',
        inspectorName: 'Max',
      });
      expect(result.success).toBe(true);
      expect(result.data.propertyId).toBe(1);
    });
  });

  describe('inspectionResultSchema', () => {
    it('should accept valid result with OK status', () => {
      const result = inspectionResultSchema.safeParse({
        checklistItemId: 1,
        status: 'OK',
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid result with DEFECT status and comment', () => {
      const result = inspectionResultSchema.safeParse({
        checklistItemId: 1,
        status: 'DEFECT',
        comment: 'Riss in der Fassade',
        photoUrl: '/uploads/photo.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('should accept NOT_APPLICABLE status', () => {
      const result = inspectionResultSchema.safeParse({
        checklistItemId: 1,
        status: 'NOT_APPLICABLE',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const result = inspectionResultSchema.safeParse({
        checklistItemId: 1,
        status: 'INVALID',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('idParamSchema', () => {
    it('should accept valid numeric id', () => {
      const result = idParamSchema.safeParse({ id: '5' });
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(5);
    });

    it('should reject non-numeric id', () => {
      const result = idParamSchema.safeParse({ id: 'abc' });
      expect(result.success).toBe(false);
    });

    it('should reject zero id', () => {
      const result = idParamSchema.safeParse({ id: '0' });
      expect(result.success).toBe(false);
    });
  });
});
