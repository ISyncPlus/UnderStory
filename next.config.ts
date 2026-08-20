import type { NextConfig } from 'next';

/**
 * Fixture mode.
 *
 * With `UNDERSTORY_FIXTURES=1`, `@/lib/neo4j` resolves to an in-memory
 * stand-in that answers every query from the same dataset the seed script
 * writes. It exists so the interface can be developed, reviewed and
 * screenshotted before an instance is provisioned — and so a reviewer can run
 * the application immediately. A normal build never applies the alias.
 */
const useFixtures = process.env.UNDERSTORY_FIXTURES === '1';

const nextConfig: NextConfig = {
  // The Bolt driver is a Node.js TCP client: it can never run on the Edge
  // runtime, and bundling it for the browser would be a mistake we want to
  // fail loudly rather than silently.
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
      // Rewrite the request rather than aliasing it: Next resolves `@/…`
      // through a tsconfig-paths plugin, which runs at the same resolve stage
      // as `resolve.alias` and wins often enough not to rely on.
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
