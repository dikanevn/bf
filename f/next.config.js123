/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/ynftnext',
  assetPrefix: '/ynftnext/',
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      os: false,
      path: false,
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
    };
    return config;
  },
  transpilePackages: [
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-wallets',
  ],
};

module.exports = nextConfig; 