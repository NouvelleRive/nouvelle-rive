import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  env: {
    SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN,
  },
}

export default nextConfig
