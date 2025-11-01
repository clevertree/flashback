/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
  webpack: (config, { isServer }) => {
    config.module.rules.push({
      test: /\.cy\.(ts|tsx)$/,
      use: 'null-loader',
    });
    config.watchOptions = {
      ignored: ['**/node_modules/**', '**/.next/**', '**/target/**'],
    };
    return config;
  },
};

export default nextConfig;
