import { PrismaClient } from "@prisma/client";

let prisma;

export function getPrisma() {
  if (!prisma) {
    let datasourceUrl = process.env.DATABASE_URL;

    // Fallback to legacy environment variables for seamless deployment on VPS
    if (!datasourceUrl && process.env.DB_HOST && process.env.DB_NAME) {
      const user = process.env.DB_USER || "root";
      const pass = process.env.DB_PASSWORD ? encodeURIComponent(process.env.DB_PASSWORD) : "";
      const host = process.env.DB_HOST;
      const port = process.env.DB_PORT || "3306";
      const db = process.env.DB_NAME;
      datasourceUrl = `mysql://${user}:${pass}@${host}:${port}/${db}`;
    }

    prisma = new PrismaClient(datasourceUrl ? {
      datasources: {
        db: {
          url: datasourceUrl
        }
      }
    } : undefined);
  }
  return prisma;
}

export async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

export { prisma };
