"use client";

import { useEffect } from "react";
import { registerServiceWorker, syncPush } from "@/lib/push-client";

/** 앱 시작 시 서비스워커 등록 + (권한이 있으면) 푸시 구독 최신화 */
export default function PwaBootstrap() {
  useEffect(() => {
    registerServiceWorker().then(() => {
      try {
        const user = localStorage.getItem("currentUser");
        if (localStorage.getItem("isLoggedIn") === "true" && user) syncPush(user);
      } catch {
        /* 사파리 사생활 보호 모드 등 */
      }
    });
  }, []);
  return null;
}
