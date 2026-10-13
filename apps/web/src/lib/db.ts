import { PrismaClient } from "@prisma/client";

// TEMPORARY exception to the web/API boundary: the signup-login auth code still
// runs in the web app and uses the client generated from apps/api's schema.
// Candidate spec `auth-api-migration` moves that code into the API and deletes this file.

// Reuse one client across dev hot reloads instead of opening a new pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
