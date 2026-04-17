import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const HEADER = 'x-request-id';

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
  }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get(HEADER);
  const id =
    typeof incoming === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(incoming)
      ? incoming
      : randomUUID();
  req.id = id;
  res.set(HEADER, id);
  next();
}
