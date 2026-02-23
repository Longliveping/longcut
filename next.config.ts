import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Avoid ESLint patch incompatibility failures during CI/production builds
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Mark better-sqlite3 as external for server components (don't bundle for client)
  serverExternalPackages: ['better-sqlite3'],
  webpack: (config, { isServer }) => {
    // Suppress the punycode deprecation warning
    if (!isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        punycode: false,
      };
    }

    // Exclude better-sqlite3 from client bundle (server-only module)
    if (!isServer) {
      config.externals = [...(config.externals || []), 'better-sqlite3'];
    }

    return config;
  },
  // Turbopack configuration
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
