import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

// Create connection pool
// For Coolify databases, SSL might not be required
const pool = globalForPrisma.pool ?? new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Disable SSL for Coolify (set to false if SSL is not supported)
  // Set to { rejectUnauthorized: false } if SSL is required
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// Create adapter
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  
  // Query optimization
  errorFormat: 'minimal',
});

// Graceful shutdown - close connections properly
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

// Handle graceful shutdown for multiple scenarios
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received. Closing Prisma connection...`);
  await prisma.$disconnect();
  await pool.end();
  console.log('Prisma connection closed successfully.');
  process.exit(0);
};

// Handle different shutdown signals
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  await pool.end();
});

// Handle SIGTERM (Docker, Kubernetes, PM2)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});

export default prisma;
