// PROJECT_ROOT/lib/webpush.ts
// 서버 전용: 외부 라이브러리 없이 Node 내장 crypto 로 Web Push(VAPID + aes128gcm 암호화)를 보냅니다.
// 규격: RFC 8291 (메시지 암호화), RFC 8292 (VAPID), RFC 8188 (aes128gcm)
import crypto from "crypto";

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type VapidKeys = {
  publicKey: string; // base64url, 65바이트 비압축 P-256 공개키
  privateKey: string; // base64url, 32바이트 비밀 스칼라(d)
  subject: string; // "mailto:..." 또는 https URL
};

const b64u = {
  encode: (buf: Buffer | Uint8Array) => Buffer.from(buf).toString("base64url"),
  decode: (str: string) => Buffer.from(str, "base64url"),
};

function hmac(key: Buffer, data: Buffer) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

/** VAPID JWT 생성 (ES256) */
export function createVapidAuthHeader(endpoint: string, vapid: VapidKeys, expSeconds = 12 * 60 * 60) {
  const pub = b64u.decode(vapid.publicKey);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error("VAPID 공개키 형식이 올바르지 않습니다.");

  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: vapid.privateKey,
    x: b64u.encode(pub.subarray(1, 33)),
    y: b64u.encode(pub.subarray(33, 65)),
  };
  const key = crypto.createPrivateKey({ key: jwk, format: "jwk" });

  const aud = new URL(endpoint).origin;
  const header = b64u.encode(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u.encode(
    Buffer.from(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + expSeconds, sub: vapid.subject }))
  );
  const unsigned = `${header}.${claims}`;
  const sig = crypto.sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });

  return `vapid t=${unsigned}.${b64u.encode(sig)}, k=${vapid.publicKey}`;
}

/** 페이로드를 aes128gcm 으로 암호화 (RFC 8291) */
export function encryptPayload(
  payload: Buffer,
  sub: PushSubscriptionJSON,
  rs = 4096,
  fixed?: { salt: Buffer; asPrivateKey: Buffer } // 테스트 벡터 검증용
) {
  const uaPublic = b64u.decode(sub.keys.p256dh);
  const authSecret = b64u.decode(sub.keys.auth);

  const ecdh = crypto.createECDH("prime256v1");
  let asPublic: Buffer;
  if (fixed) {
    ecdh.setPrivateKey(fixed.asPrivateKey);
    asPublic = ecdh.getPublicKey();
  } else {
    asPublic = ecdh.generateKeys();
  }
  const shared = ecdh.computeSecret(uaPublic);

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_public || as_public, 32)
  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);

  const salt = fixed ? fixed.salt : crypto.randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);

  // 단일 레코드 + 마지막 레코드 구분자(0x02)
  const plaintext = Buffer.concat([payload, Buffer.from([2])]);
  if (plaintext.length + 16 > rs) throw new Error("푸시 페이로드가 너무 큽니다.");

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(16 + 4 + 1);
  salt.copy(header, 0);
  header.writeUInt32BE(rs, 16);
  header.writeUInt8(asPublic.length, 20);

  return Buffer.concat([header, asPublic, encrypted]);
}

export type SendResult = { ok: boolean; status: number; gone: boolean; body?: string };

/** 단일 구독으로 푸시 전송. gone=true 면 만료된 구독이므로 삭제하면 됩니다. */
export async function sendWebPush(
  sub: PushSubscriptionJSON,
  data: unknown,
  vapid: VapidKeys,
  options: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high"; topic?: string } = {}
): Promise<SendResult> {
  const body = encryptPayload(Buffer.from(JSON.stringify(data)), sub);
  const headers: Record<string, string> = {
    Authorization: createVapidAuthHeader(sub.endpoint, vapid),
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    TTL: String(options.ttl ?? 60 * 60 * 24),
    Urgency: options.urgency ?? "high",
  };
  if (options.topic) headers.Topic = options.topic;

  const res = await fetch(sub.endpoint, { method: "POST", headers, body: new Uint8Array(body) });
  const text = res.ok ? undefined : await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410, body: text };
}
