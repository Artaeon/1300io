const { PrismaClient } = require('@prisma/client');

// Single shared client. Prisma recommends exactly one per process —
// multiple clients duplicate connection pools and hit the db's
// max_connections ceiling under load.
const prisma = global.__prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

module.exports = prisma;
