import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 1. PWA 매니페스트 및 앱 메타데이터 설정
export const metadata: Metadata = {
  title: "Dating PWA App",
  description: "지도 기반 데이터 및 푸시 알림을 지원하는 데이팅 앱",
  manifest: "/manifest.json", // public/manifest.json 파일을 읽어옵니다.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DatingApp",
  },
};

// 2. 모바일 웹앱(PWA) 최적화를 위한 뷰포트 설정
export const viewport: Viewport = {
  themeColor: "#ff4757", // 앱 상단 바 등의 테마 색상
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,       // 사용자가 손가락으로 줌인하는 것을 막아 네이티브 앱 느낌을 줌
  userScalable: false,   // 확대/축소 비활성화
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko" // 한국어 서비스 설정
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col select-none touch-pan-y bg-stone-100">
        {/* - select-none: 텍스트 드래그 블록을 막아 앱 같은 느낌을 줍니다.
          - touch-pan-y: 상하 스크롤은 허용하되, 좌우 스와이프 이탈을 방지합니다.
          - bg-stone-100: max-w-md 모바일 컨테이너 바깥 PC 화면 영역을 깔끔한 배경색으로 채워줍니다.
        */}
        <main className="flex-1 w-full max-w-md mx-auto bg-white shadow-sm overflow-x-hidden min-h-screen flex flex-col">
          {/* 모바일 타겟 앱 화면 구조 */}
          {children}
        </main>

        {/* [카카오 지도 API 스크립트 연동]
          - 보내주신 실제 JavaScript 키를 완벽히 적용했습니다.
          - 장소 키워드 검색 라이브러리(&libraries=services)를 함께 로드합니다.
          - Next.js 환경에서 비동기 충돌이 없도록 autoload=false 처리를 함께 구성했습니다.
        */}
        <Script
          src="//dapi.kakao.com/v2/maps/sdk.js?appkey=c873ecb11cbc9f6f3c4dc553826973fa&libraries=services&autoload=false"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}