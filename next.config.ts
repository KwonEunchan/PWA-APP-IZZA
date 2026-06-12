import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    skipWaiting: true,
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 💡 아래 설정을 추가하여 Webpack을 강제로 사용하게 하여 Turbopack 충돌을 방지합니다.
  webpack: (config) => {
    return config;
  },
};

export default withPWA(nextConfig);