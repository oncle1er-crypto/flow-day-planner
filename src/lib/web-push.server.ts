/**
 * Minimal Web Push implementation using WebCrypto (Cloudflare Workers compatible).
 * Supports aes128gcm content encoding (RFC 8291) + VAPID (RFC 8292).
 */

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

async function importVapidPrivateKey(privB64u: string, pubB64u: string): Promise<CryptoKey> {
  const pub = b64urlDecode(pubB64u); // 65 bytes uncompressed
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: privB64u,
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function signVapidJwt(audience: string, subject: string, pubKey: string, privKey: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const payload = { aud: audience, exp, sub: subject };
  const enc = new TextEncoder();
  const h = b64urlEncode(enc.encode(JSON.stringify(header)));
  const p = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${h}.${p}`;
  const key = await importVapidPrivateKey(privKey, pubKey);
  const sigDer = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signingInput));
  return `${signingInput}.${b64urlEncode(sigDer)}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, { name: "HKDF" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/** Encrypt payload with aes128gcm per RFC 8291. */
async function encryptPayload(
  payload: Uint8Array,
  ua_public_b64u: string,
  ua_auth_b64u: string,
): Promise<{ body: Uint8Array }> {
  const uaPublic = b64urlDecode(ua_public_b64u); // 65 bytes
  const uaAuth = b64urlDecode(ua_auth_b64u);

  // Generate ephemeral ECDH keypair
  const asKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const asPublicJwk = await crypto.subtle.exportKey("jwk", asKeyPair.publicKey);
  const asPublic = concat(
    new Uint8Array([0x04]),
    b64urlDecode(asPublicJwk.x as string),
    b64urlDecode(asPublicJwk.y as string),
  );

  // Import UA public key for ECDH
  const uaPublicJwk = {
    kty: "EC",
    crv: "P-256",
    x: b64urlEncode(uaPublic.slice(1, 33)),
    y: b64urlEncode(uaPublic.slice(33, 65)),
    ext: true,
  };
  const uaPubKey = await crypto.subtle.importKey(
    "jwk",
    uaPublicJwk,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: uaPubKey },
    asKeyPair.privateKey,
    256,
  );
  const ecdhSecret = new Uint8Array(sharedBits);

  // PRK_key = HKDF(auth_secret, ecdhSecret, key_info, 32)
  const enc = new TextEncoder();
  const keyInfo = concat(
    enc.encode("WebPush: info\0"),
    uaPublic,
    asPublic,
  );
  const ikm = await hkdf(uaAuth, ecdhSecret, keyInfo, 32);

  // salt (16 random bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // CEK = HKDF(salt, ikm, "Content-Encoding: aes128gcm\0", 16)
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  // NONCE = HKDF(salt, ikm, "Content-Encoding: nonce\0", 12)
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  // plaintext = payload || 0x02 (padding delimiter, no extra padding)
  const plaintext = concat(payload, new Uint8Array([0x02]));

  const aesKey = await crypto.subtle.importKey("raw", cek as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aesKey, plaintext as BufferSource),
  );

  // Header: salt (16) || rs (4, big-endian = 4096) || idlen (1) || keyid (idlen bytes)
  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]); // 4096
  const idlen = new Uint8Array([asPublic.length]); // 65
  const body = concat(salt, rs, idlen, asPublic, ct);
  return { body };
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendPushResult {
  status: number;
  ok: boolean;
  expired: boolean;
}

export async function sendWebPush(
  sub: PushSubscriptionRecord,
  payload: unknown,
  opts: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high" } = {},
): Promise<SendPushResult> {
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error("VAPID keys missing");

  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await signVapidJwt(audience, VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const payloadBytes = new TextEncoder().encode(
    typeof payload === "string" ? payload : JSON.stringify(payload ?? {}),
  );
  const { body } = await encryptPayload(payloadBytes, sub.p256dh, sub.auth);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(opts.ttl ?? 60 * 60 * 24),
      Urgency: opts.urgency ?? "normal",
      Authorization: `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`,
    },
    body: body as BodyInit,
  });
  const expired = res.status === 404 || res.status === 410;
  return { status: res.status, ok: res.ok, expired };
}