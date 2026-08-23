// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // NOTE: Do NOT set `nitro: { preset: "vercel" }` here — cela casse le build
  // de production Lovable (les env Supabase ne sont plus injectées dans le
  // worker). Pour un déploiement Vercel, définir la variable d'env
  // `NITRO_PRESET=vercel` dans Vercel (cf. VERCEL.md) ou activer le preset
  // uniquement dans un fork dédié.
  //
  // PWA/offline is implemented by public/sw.js instead of vite-plugin-pwa.
  // TanStack Start/Nitro emits deployment assets outside a conventional dist
  // directory, which made Workbox generate an empty precache on Vercel. The
  // custom worker also guarantees that authenticated Supabase API responses
  // are never written to the shared browser Cache Storage.
  vite: {
    plugins: [mcpPlugin()],
  },
});
