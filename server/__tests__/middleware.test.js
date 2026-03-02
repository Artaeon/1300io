const { asyncHandler, errorHandler } = require('../middleware/errorHandler');

describe('Error Handler Middleware', () => {
  function mockRes() {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  }

  describe('asyncHandler', () => {
    it('should call the wrapped function', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const handler = asyncHandler(fn);
      const req = {};
      const res = mockRes();
      const next = vi.fn();

      await handler(req, res, next);
      expect(fn).toHaveBeenCalledWith(req, res, next);
    });

    it('should call next with error on rejection', async () => {
      const error = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(error);
      const handler = asyncHandler(fn);
      const req = {};
      const res = mockRes();
      const next = vi.fn();

      await handler(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('errorHandler', () => {
    it('should return 500 for generic errors', () => {
      const err = new Error('Something broke');
      const req = { method: 'GET', path: '/test' };
      const res = mockRes();
      const next = vi.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Internal server error' })
      );
    });

    it('should return 413 for file size errors', () => {
      const err = new Error('File too large');
      err.code = 'LIMIT_FILE_SIZE';
      const req = { method: 'POST', path: '/api/upload' };
      const res = mockRes();
      const next = vi.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
    });

    it('should return custom status code when set', () => {
      const err = new Error('Not found');
      err.statusCode = 404;
      err.expose = true;
      const req = { method: 'GET', path: '/test' };
      const res = mockRes();
      const next = vi.fn();

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Not found' })
      );
    });
  });
});
