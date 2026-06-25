# Plan — Hors-ligne complet (app shell PWA)

Objectif : permettre l'ouverture et l'usage de Smart Daily Tasks **sans aucune connexion Internet** après la première visite, en complément du cache de données et de la file de sync déjà en place.

## Ce qui change

### 1. Ajouter `vite-plugin-pwa` (mode `generateSW`)
- Installation : `bun add -D vite-plugin-pwa workbox-window`
- Configuration dans `vite.config.ts` :
  - `registerType: "autoUpdate"`
  - `devOptions: { enabled: false }` (jamais en dev/preview Lovable)
  - `injectRegister: null` (registration manuelle, contrôlée)
  - `filename: "sw.js"` (à la racine, scope `/`)
  - Manifest réutilisé depuis le `manifest.webmanifest` existant
  - Workbox runtime caching :
    - **Navigations HTML** → `NetworkFirst` (jamais cache-first)
    - **Assets buildés same-origin (JS/CSS/woff2/images hashés)** → `CacheFirst`
    - **API Lovable Cloud / Supabase** → `NetworkFirst` court (fallback cache pour lecture seule)
    - Exclure `/~oauth`, `/api/`, `sw-push.js` du fallback de navigation
- Le service worker push existant (`public/sw-push.js`) reste **inchangé** — c'est un worker séparé pour les notifications, distinct de l'app shell.

### 2. Wrapper de registration sécurisé
Nouveau fichier `src/lib/register-sw.ts` qui :
- Refuse l'enregistrement si : pas en production, dans une iframe, hostname `id-preview--*` / `preview--*` / `*.lovableproject.com` / `*.lovableproject-dev.com` / `*.beta.lovable.dev`, ou URL contient `?sw=off`.
- Dans ces cas : désenregistre proactivement tout `/sw.js` déjà installé (kill-switch).
- Appelé une seule fois depuis `src/router.tsx` (ou point d'entrée client équivalent).

### 3. Indicateur "prêt hors-ligne"
- Mini toast/badge "App prête hors-ligne ✓" la première fois que le SW termine son install (via `workbox-window`).
- Toast "Nouvelle version disponible — recharger" quand un SW met à jour (autoUpdate recharge tout seul, on informe juste l'utilisateur).

### 4. Documentation utilisateur (pas de code)
Dans le menu Paramètres, petite note explicative :
> Hors-ligne : créer, modifier, cocher des tâches/habitudes fonctionne sans réseau. La connexion, l'IA et les notifications push nécessitent Internet.

## Ce qui ne change pas
- `sw-push.js` (notifications push en arrière-plan) — laissé tel quel.
- IndexedDB + file de sync (`offline-db.ts`, `sync-queue.ts`) déjà en place.
- Persistance React Query déjà en place.
- Aucune modification de schéma / backend.

## Limites assumées
- **Auth, IA, push serveur** restent online — pas contournable.
- **Première visite** sur un appareil exige toujours Internet (le SW doit d'abord se télécharger).
- **Preview Lovable** : le SW ne s'enregistre **pas** (par design, évite caches périmés). Test hors-ligne uniquement sur l'URL publiée `tache-daily.lovable.app`.
- iOS : ajout à l'écran d'accueil obligatoire pour un comportement standalone fiable.

## Validation
Après build :
1. Ouvrir l'URL publiée → vérifier SW enregistré (DevTools → Application).
2. Activer "Offline" dans DevTools, recharger → l'app doit s'ouvrir et naviguer.
3. Créer une tâche hors-ligne → vérifier qu'elle apparaît, puis se synchronise au retour réseau.
4. Vérifier que `sw-push.js` est toujours actif en parallèle.
