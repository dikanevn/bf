import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/ynftnext',
  assetPrefix: '/ynftnext/',
  output: 'export',
  transpilePackages: [
    '@metaplex-foundation/js',
    '@metaplex-foundation/mpl-token-metadata',
    '@metaplex-foundation/mpl-candy-machine',
    '@metaplex-foundation/umi',
    '@metaplex-foundation/umi-bundle-defaults',
    '@metaplex-foundation/umi-signer-wallet-adapters',
    '@metaplex-foundation/mpl-toolbox'
  ],
  webpack: (config) => {
    config.module.rules.push({
      test: /\.json$/,
      type: 'json',
    });
    
    config.resolve.fallback = { 
      fs: false, 
      path: false 
    };
    
    return config;
  },
};

export default nextConfig;
