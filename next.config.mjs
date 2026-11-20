/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@electric-sql/pglite'],
  eslint: { ignoreDuringBuilds: true },
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
};
export default nextConfig;
