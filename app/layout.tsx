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

// 1. PWA 매니페스트 및 앱 메타데이터 설정 (iOS 아이콘 연동 추가)
export const metadata: Metadata = {
  title: "이짜!",
  description: "은찬이랑 민지의 데이트 코스 기록 앱",
  manifest: "/manifest.json", 
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DatingApp",
  },
  icons: {
    apple: "/icon-192.png", // public/icon-192.png 파일과 매핑됩니다.
  },
};

// 2. 모바일 웹앱(PWA) 최적화를 위한 뷰포트 설정
export const viewport: Viewport = {
  themeColor: "#ff4757", // manifest.json의 theme_color도 이 색상과 맞추는 것을 추천합니다.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col select-none touch-pan-y bg-stone-100">
        <main className="flex-1 w-full max-w-md mx-auto bg-white shadow-sm overflow-x-hidden min-h-screen flex flex-col">
          {children}
        </main>

        {/* [카카오 지도 API 스크립트 연동 최적화]
          - 프로토콜(// 대신 https:)을 명시하여 로컬 환경(http://localhost)에서의 파싱 에러를 방지합니다.
          - Next.js Webpack 빌드 환경에서 HTML 파싱 순서 충돌을 막기 위해 
            strategy를 "beforeInteractive" 대신 "afterInteractive" 또는 생략(기본값)하는 것이 안전합니다.
        */}
        <Script
          src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=c873ecb11cbc9f6f3c4dc553826973fa&libraries=services&autoload=false"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}