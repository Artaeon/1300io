import type { Request } from 'express';
import prisma from './lib/prisma';
import logger from './logger';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'TOKEN_REFRESH'
  | 'ACCOUNT_LOCKED';

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId: number;
  userId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  previousData?: unknown;
  newData?: unknown;
}

export async function createAuditEntry(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        userId: entry.userId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        previousData: entry.previousData ? JSON.stringify(entry.previousData) : null,
        newData: entry.newData ? JSON.stringify(entry.newData) : null,
      },
    });
  } catch (error) {
    // Audit logging should never break the main operation.
    logger.error('Failed to create audit entry', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export interface AuditContext {
  userId: number | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export function getAuditContext(req: Request): AuditContext {
  const xff = req.headers['x-forwarded-for'];
  const forwardedFor = Array.isArray(xff) ? xff[0] : xff;
  return {
    userId: req.user?.userId ?? null,
    ipAddress: req.ip ?? forwardedFor ?? null,
    userAgent: req.headers['user-agent'] ?? null,
  };
}
