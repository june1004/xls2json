/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // 클라이언트 사이드에서만 사용되는 모듈 처리
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }
    
    // 서버 사이드에서 클라이언트 전용 라이브러리 제외
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push({
        mammoth: 'commonjs mammoth',
        turndown: 'commonjs turndown',
      })
    }
    
    return config
  },
}

module.exports = nextConfig
