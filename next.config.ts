import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

// PWA 초기화 및 설정
const withPWA = withPWAInit({
  dest: "public", // 빌드 시 서비스 워커 파일이 생성될 위치
  disable: process.env.NODE_ENV === "development", // 개발 환경에서는 캐싱 간섭을 막기 위해 PWA 비활성화
  register: true, // 브라우저에 서비스 워커를 자동으로 등록
  workboxOptions: {
    skipWaiting: true, // 업데이트된 서비스 워커가 즉시 활성화되도록 설정
  },
});

// Next.js 기본 설정
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 추가적인 웹팩 설정이나 이미지 도메인 설정이 필요하다면 이곳에 작성합니다.
};

// PWA 설정으로 Next.js 설정을 감싸서 내보냄
export default withPWA(nextConfig);