// PROJECT_ROOT/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// 유저님의 실제 파이어베이스 설정값
const firebaseConfig = {
  apiKey: "AIzaSyBa1NZZTkJDtSMcIvgwWEhjnjry1QYmU5c",
  authDomain: "pwa-app-01-6b48c.firebaseapp.com",
  projectId: "pwa-app-01-6b48c",
  storageBucket: "pwa-app-01-6b48c.firebasestorage.app",
  messagingSenderId: "338507402289",
  appId: "1:338507402289:web:5e66df78a2fc6066439910",
  measurementId: "G-GZEXBDN2CR"
};

// ⚠️ [Next.js 필수 조치] 새로고침(Hot Reload) 시 중복 초기화 에러 방지 (싱글톤)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// 🚀 Firestore 데이터베이스 인스턴스 생성 및 export
// 이제 다른 파일에서 `import { db } from '@/lib/firebase'` 형태로 쓸 수 있습니다.
export const db = getFirestore(app);

// 📊 Analytics는 브라우저(window) 환경에서만 실행되도록 안전하게 방어막 구축
export const analytics = typeof window !== "undefined" 
  ? isSupported().then((supported) => (supported ? getAnalytics(app) : null))
  : null;