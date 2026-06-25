/**
 * Guarded service-worker registration for the app shell (vite-plugin-pwa).
 * - Never registers in dev, preview, iframes, or when ?sw=off is set.
 * - Unregisters any stale /sw.js in those contexts.
 * - Leaves the separate push worker (/sw-push.js) untouched.
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
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(APP_SW_URL);
        })
        .map((r) => r.unregister()),
    );
  } catch {
    /* ignore */
  }
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
    const { Workbox } = await import("workbox-window");
    const wb = new Workbox(APP_SW_URL);

    let firstInstall = true;
    wb.addEventListener("installed", (event) => {
      if (!event.isUpdate && firstInstall) {
        firstInstall = false;
        toast.success("App prête hors-ligne", {
          description: "Vous pouvez maintenant l'utiliser sans connexion.",
        });
      }
    });
    wb.addEventListener("waiting", () => {
      toast("Nouvelle version disponible", {
        description: "Rechargez pour mettre à jour.",
        action: { label: "Recharger", onClick: () => window.location.reload() },
      });
    });

    await wb.register();
  } catch (err) {
    console.warn("[sw] registration failed", err);
  }
}