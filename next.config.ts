import type { NextConfig } from 'next';

/** Fixture mode. */
const useFixtures = process.env.UNDERSTORY_FIXTURES === '1';

const nextConfig: NextConfig = {
  serverExternalPackages: ['neo4j-driver'],
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: false },
  turbopack: useFixtures
    ? {
        resolveAlias: {
          '@/lib/neo4j': './src/lib/neo4j.fixture.ts',
        },
      }
    : {},
  webpack: (config, { webpack }) => {
    if (useFixtures) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/[\\/]lib[\\/]neo4j$/, (resource: { request: string }) => {
          resource.request = `${resource.request}.fixture`;
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
