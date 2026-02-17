/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  // Enable standalone output for Docker / AWS Amplify
  output: 'standalone',
  // Ensure ws and other Node.js modules are not bundled into serverless functions
  serverExternalPackages: ['ws', '@prisma/client', 'prisma'],
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/dashboard/default",
        permanent: false,
      },
      {
        source: "/login",
        destination: "/admin-guru",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
