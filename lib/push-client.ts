// PROJECT_ROOT/lib/push-client.ts
// 브라우저 전용: 서비스워커 등록, 푸시 구독/저장, 상대방에게 알림 요청
import { db } from "@/lib/firebase";
import { deleteDoc, doc, setDoc } from "firebase/firestore";

export type UserKey = "me" | "minji";

// 공개키는 노출돼도 되는 값입니다. (비밀키는 서버 환경변수 VAPID_PRIVATE_KEY)
export const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BOYPlRRCpDXDYIA2o1Aa9dlu5H9tMY00HzcSrYD58W4nFszlNY9e7RONSzP6SXiUPsjHKVb8iMCpd1zPzlPkVgI";

export const partnerOf = (u: string): UserKey => (u === "minji" ? "me" : "minji");
export const nameOf = (u: string) => (u === "minji" ? "민지" : "은찬");
/** "은찬이가" / "민지가" */
export const subjectOf = (u: string) => (u === "minji" ? "민지가" : "은찬이가");

export type PushState = "unsupported" | "needs-install" | "denied" | "default" | "granted";

export function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function getPushState(): PushState {
  if (typeof window === "undefined") return "unsupported";
  // iOS 는 홈 화면에 추가한 PWA 에서만 웹 푸시가 됩니다 (iOS 16.4+)
  if (isIos() && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission as PushState;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function endpointId(endpoint: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 40);
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return await navigator.serviceWorker.ready;
  } catch (e) {
    console.error("서비스워커 등록 실패:", e);
    return null;
  }
}

async function getOrCreateSubscription(reg: ServiceWorkerRegistration) {
  const key = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();

  // 예전에 다른 키로 구독돼 있으면 새 키로 다시 구독
  if (sub) {
    const current = sub.options?.applicationServerKey;
    if (current) {
      const a = new Uint8Array(current);
      const same = a.length === key.length && a.every((v, i) => v === key[i]);
      if (!same) {
        await sub.unsubscribe();
        sub = null;
      }
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }
  return sub;
}

async function saveSubscription(user: string, sub: PushSubscription) {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
  const id = await endpointId(json.endpoint);
  await setDoc(doc(db, "push_subscriptions", id), {
    user,
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    userAgent: navigator.userAgent.slice(0, 200),
    updatedAt: new Date(),
  });
}

/** 알림 켜기 버튼에서 호출 (반드시 사용자 클릭 안에서 호출해야 iOS 에서 동작) */
export async function enablePush(user: string): Promise<PushState> {
  const state = getPushState();
  if (state === "unsupported" || state === "needs-install") return state;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission as PushState;

  const reg = await registerServiceWorker();
  if (!reg) return "unsupported";
  const sub = await getOrCreateSubscription(reg);
  await saveSubscription(user, sub);
  return "granted";
}

/** 앱을 열 때마다 조용히 구독 정보를 최신화 (이미 권한을 허용한 경우만) */
export async function syncPush(user: string) {
  if (getPushState() !== "granted") return;
  const reg = await registerServiceWorker();
  if (!reg) return;
  try {
    const sub = await getOrCreateSubscription(reg);
    await saveSubscription(user, sub);
  } catch (e) {
    console.error("푸시 구독 동기화 실패:", e);
  }
}

/** 로그아웃 시: 이 기기로는 더 이상 알림이 오지 않게 구독 정보 삭제 */
export async function detachPush() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await deleteDoc(doc(db, "push_subscriptions", await endpointId(sub.endpoint)));
  } catch (e) {
    console.error("푸시 구독 해제 실패:", e);
  }
}

/** 상대방에게 푸시 알림 보내기. 실패해도 앱 동작에는 영향 없음. */
export async function notifyPartner(
  from: string,
  message: { title: string; body: string; url?: string; tag?: string }
) {
  try {
    await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: partnerOf(from), ...message }),
      keepalive: true, // 화면 이동 중에도 요청이 끊기지 않게
    });
  } catch (e) {
    console.error("알림 전송 실패:", e);
  }
}
