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
  // 💡 Turbopack 에러를 근본적으로 해결하는 설정입니다.
  // turbopack 속성을 빈 객체로 선언하여 기본 빌드 엔진과 충돌하지 않게 합니다.
  // @ts-ignore: Next.js 16 타입 정의와의 충돌을 피하기 위해 추가합니다.
  turbopack: {}, 
};

export default withPWA(nextConfig);