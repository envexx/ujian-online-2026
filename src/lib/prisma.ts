import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig, Pool } from '@neondatabase/serverless';

// Only set ws in Node.js runtime (not edge/serverless that already has WebSocket)
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    // Dynamic import to avoid bundling issues in serverless
    const ws = require('ws');
    neonConfig.webSocketConstructor = ws;
  } catch {
    // ws not available — running in an environment with native WebSocket
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaNeon(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    errorFormat: 'minimal',
  } as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown — only register in long-running processes (not serverless)
if (typeof process !== 'undefined' && process.env.NODE_ENV !== 'production') {
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n${signal} received. Closing Prisma connection...`);
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('beforeExit', async () => {
    await prisma.$disconnect();
  });

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export default prisma;
