const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAuditEntry({ action, entityType, entityId, userId, ipAddress, userAgent, previousData, newData }) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId,
        userId: userId || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        previousData: previousData ? JSON.stringify(previousData) : null,
        newData: newData ? JSON.stringify(newData) : null,
      }
    });
  } catch (error) {
    // Audit logging should never break the main operation
    console.error('[Audit] Failed to create audit entry:', error.message);
  }
}

// Extract audit context from Express request
function getAuditContext(req) {
  return {
    userId: req.user?.userId || null,
    ipAddress: req.ip || req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

module.exports = { createAuditEntry, getAuditContext };
