// Public VAPID key — safe to ship in the client bundle.
// Mirrors the VAPID_PUBLIC_KEY server secret.
export const VAPID_PUBLIC_KEY =
  "BNeeJc3cZDdvCkvfkY6tdqjFd1_ZDN0ajYBAQ1-T0M2i1OSfAuz6K16IVW6qMMElXeyduQvKVe-VvoZ1cXe3wPY";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}