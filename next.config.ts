import type { NextConfig } from "next";

// 서비스워커는 public/sw.js 를 직접 사용합니다. (next-pwa 는 Turbopack 빌드에서 sw 를 만들지 못해 제거)
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 폰에서 같은 와이파이의 PC IP(예: http://192.168.0.10:3000)로 개발 서버에 접속할 수 있게 허용.
  // Next 16 은 기본적으로 localhost 외 주소의 개발용 JS 요청을 막아서, 화면만 뜨고 버튼이 먹통이 됩니다.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
