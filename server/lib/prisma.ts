import { PrismaClient } from '@prisma/client';

// Single shared client. Prisma recommends exactly one per process —
// multiple clients duplicate connection pools and hit the db's
// max_connections ceiling under load.
//
// In dev (with tsx --watch / nodemon), the module cache is reset on
// every reload. Attaching the client to globalThis prevents a new
// PrismaClient (and a new pool) from being created on every reload.
declare global {

  var __prisma: PrismaClient | undefined;
}

const prisma: PrismaClient = globalThis.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export = prisma;
