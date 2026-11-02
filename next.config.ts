import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 開発サーバーを LAN の IP で開いたときにもクライアント側の起動を許可する
  allowedDevOrigins: ['192.168.11.31'],
}

export default nextConfig
