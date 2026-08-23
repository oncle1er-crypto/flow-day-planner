import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  savePushSubscription,
  deletePushSubscription,
  saveUserTimezone,
} from "@/lib/push.functions";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "@/lib/vapid";

type Status = "unsupported" | "idle" | "subscribed";

const APP_SW_URL = "/sw.js";

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAppServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing?.active?.scriptURL.endsWith(APP_SW_URL)) return existing;

  const registration = await navigator.serviceWorker.register(APP_SW_URL, { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}

export function useBackgroundPush() {
  const [status, setStatus] = useState<Status>("idle");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  useEffect(() => {
    if (!isSupported) {
      setStatus("unsupported");
      return;
    }
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (!reg?.active?.scriptURL.endsWith(APP_SW_URL)) return;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setEndpoint(sub.endpoint);
          setStatus("subscribed");
        }
      } catch (e) {
        console.warn("[push] init", e);
      }
    })();
  }, [isSupported]);

  const saveTz = useMutation({
    mutationFn: (tz: string) => saveUserTimezone({ data: { timezone: tz } }),
  });

  const subscribe = useCallback(async () => {
    setError(null);
    if (!isSupported) {
      setStatus("unsupported");
      return false;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setError("Permission refusée");
        return false;
      }

      const reg = await getAppServiceWorkerRegistration();
      if (!reg) throw new Error("Service worker indisponible");

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }
      const p256dh = arrayBufferToBase64Url(sub.getKey("p256dh"));
      const auth = arrayBufferToBase64Url(sub.getKey("auth"));
      await savePushSubscription({
        data: {
          endpoint: sub.endpoint,
          p256dh,
          auth,
          user_agent: navigator.userAgent,
        },
      });
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        await saveTz.mutateAsync(tz);
      } catch {
        // ignore timezone update failures; the subscription itself is valid
      }
      setEndpoint(sub.endpoint);
      setStatus("subscribed");
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return false;
    } finally {
      setBusy(false);
    }
  }, [isSupported, saveTz]);

  const unsubscribe = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const ep = sub.endpoint;
        await sub.unsubscribe();
        try {
          await deletePushSubscription({ data: { endpoint: ep } });
        } catch {
          // The browser subscription is already removed; retrying server cleanup can happen later.
        }
      }
      setEndpoint(null);
      setStatus("idle");
      return true;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    isSupported,
    status,
    endpoint,
    busy,
    error,
    subscribe,
    unsubscribe,
  };
}
