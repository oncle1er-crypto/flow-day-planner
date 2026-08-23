/**
 * Guarded registration for Flow Day Planner's single root-scoped service worker.
 * The same worker handles offline app assets and Web Push notifications.
 */
import { toast } from "sonner";

const APP_SW_URL = "/sw.js";

function isUnsafeHost(hostname: string): boolean {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

function shouldSkip(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return true;
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  if (isUnsafeHost(window.location.hostname)) return true;
  return false;
}

async function unregisterAppSw() {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((registration) => {
          const url =
            registration.active?.scriptURL ||
            registration.installing?.scriptURL ||
            registration.waiting?.scriptURL ||
            "";
          return url.endsWith(APP_SW_URL) || url.endsWith("/sw-push.js");
        })
        .map((registration) => registration.unregister()),
    );
  } catch {
    // Best-effort cleanup in preview/dev contexts.
  }
}

function loadedSameOriginResources(): string[] {
  const urls = new Set<string>(["/", "/auth", "/manifest.webmanifest", "/icon-512.png"]);
  if (typeof performance === "undefined") return [...urls];

  for (const entry of performance.getEntriesByType("resource")) {
    try {
      const url = new URL(entry.name, window.location.origin);
      if (url.origin === window.location.origin) urls.add(url.href);
    } catch {
      // Ignore malformed/opaque performance entries.
    }
  }
  return [...urls];
}

let registered = false;

export async function registerAppSw() {
  if (registered) return;
  registered = true;

  if (shouldSkip()) {
    await unregisterAppSw();
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(APP_SW_URL, { scope: "/" });
    const ready = await navigator.serviceWorker.ready;

    const worker =
      ready.active ?? registration.active ?? registration.waiting ?? registration.installing;
    worker?.postMessage({ type: "CACHE_URLS", urls: loadedSameOriginResources() });

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "FLOW_DAY_CACHE_READY") return;
      navigator.serviceWorker.removeEventListener("message", onMessage);
      toast.success("Mode hors-ligne activé", {
        description: "Les ressources déjà chargées sont disponibles sans connexion.",
      });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          toast("Nouvelle version disponible", {
            description: "Rechargez pour mettre à jour.",
            action: { label: "Recharger", onClick: () => window.location.reload() },
          });
        }
      });
    });
  } catch (err) {
    console.warn("[sw] registration failed", err);
  }
}
