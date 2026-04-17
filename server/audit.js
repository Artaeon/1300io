const prisma = require('./lib/prisma');
const logger = require('./logger');

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
    logger.error('Failed to create audit entry', { error: error.message });
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
