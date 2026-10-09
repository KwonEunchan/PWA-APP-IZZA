import { NextResponse } from "next/server";
import { collection, deleteDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sendWebPush, type PushSubscriptionJSON } from "@/lib/webpush";

export const dynamic = "force-dynamic";

const USERS = ["me", "minji"];

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BOYPlRRCpDXDYIA2o1Aa9dlu5H9tMY00HzcSrYD58W4nFszlNY9e7RONSzP6SXiUPsjHKVb8iMCpd1zPzlPkVgI";

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) {
    console.error("❌ [Push] VAPID_PRIVATE_KEY 환경변수가 없습니다.");
    return NextResponse.json({ error: "VAPID_PRIVATE_KEY 미설정" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const from = clip(body.from, 10);
  const to = clip(body.to, 10);
  const isTest = body.test === true; // 메인 화면의 "테스트 알림 받기" 버튼 (본인에게 전송)
  if (!USERS.includes(from) || !USERS.includes(to) || (from === to && !isTest)) {
    return NextResponse.json({ error: "잘못된 대상" }, { status: 400 });
  }

  const title = clip(body.title, 80) || "이짜!";
  const text = clip(body.body, 200);
  const rawUrl = clip(body.url, 200);
  const url = rawUrl.startsWith("/") && !rawUrl.startsWith("//") ? rawUrl : "/main";
  const tag = clip(body.tag, 60) || undefined;

  // Apple 푸시 서버는 subject 가 https URL 또는 mailto 여야 합니다.
  const origin = new URL(request.url).origin;
  const subject =
    process.env.VAPID_SUBJECT || (origin.startsWith("https://") ? origin : "mailto:noreply@izza.app");

  const snapshot = await getDocs(query(collection(db, "push_subscriptions"), where("user", "==", to)));

  let sent = 0;
  let removed = 0;
  const errors: string[] = [];

  await Promise.all(
    snapshot.docs.map(async (d) => {
      const data = d.data();
      const sub: PushSubscriptionJSON = { endpoint: data.endpoint, keys: data.keys };
      if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return;
      try {
        const result = await sendWebPush(
          sub,
          { title, body: text, url, tag },
          { publicKey: VAPID_PUBLIC_KEY, privateKey, subject }
        );
        if (result.ok) sent++;
        else if (result.gone) {
          await deleteDoc(d.ref);
          removed++;
        } else errors.push(`${result.status} ${result.body ?? ""}`.trim());
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    })
  );

  if (errors.length) console.error("❌ [Push] 일부 전송 실패:", errors);
  return NextResponse.json({ devices: snapshot.size, sent, removed, failed: errors.length });
}
