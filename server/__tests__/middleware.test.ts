import { describe, it, expect, vi } from 'vitest';
import { asyncHandler, errorHandler } from '../middleware/errorHandler';
import type { Request, Response, NextFunction } from 'express';

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    originalUrl: '/test',
    path: '/test',
    ip: '127.0.0.1',
    id: 'test-request-id',
    ...overrides,
  } as unknown as Request;
}

describe('Error Handler Middleware', () => {
  describe('asyncHandler', () => {
    it('calls the wrapped function with (req, res, next)', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const handler = asyncHandler(fn as never);
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn() as unknown as NextFunction;

      await handler(req, res, next);
      expect(fn).toHaveBeenCalledWith(req, res, next);
    });

    it('calls next with error on rejection', async () => {
      const error = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(error);
      const handler = asyncHandler(fn as never);
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn() as unknown as NextFunction;

      await handler(req, res, next);
      // Wait one microtask so the awaited promise finishes.
      await Promise.resolve();
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('errorHandler', () => {
    it('returns 500 with masked message for generic errors', () => {
      const err = new Error('Something broke');
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn() as unknown as NextFunction;

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Internal server error',
          requestId: 'test-request-id',
        }),
      );
    });

    it('returns 413 for LIMIT_FILE_SIZE', () => {
      const err = Object.assign(new Error('File too large'), { code: 'LIMIT_FILE_SIZE' });
      const req = mockReq({ method: 'POST', originalUrl: '/api/upload' });
      const res = mockRes();
      const next = vi.fn() as unknown as NextFunction;

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
    });

    it('returns custom statusCode and message when expose=true', () => {
      const err = Object.assign(new Error('Not found'), { statusCode: 404, expose: true });
      const req = mockReq();
      const res = mockRes();
      const next = vi.fn() as unknown as NextFunction;

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Not found' }),
      );
    });

    it('always includes requestId in the response body', () => {
      const err = new Error('boom');
      const req = mockReq({ id: 'abc-123' });
      const res = mockRes();
      const next = vi.fn() as unknown as NextFunction;

      errorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'abc-123' }),
      );
    });
  });
});
