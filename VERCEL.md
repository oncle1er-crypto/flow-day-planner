# Déploiement sur Vercel (hybride)

Frontend + server functions sur **Vercel**, base de données / Auth / `pg_cron` / Edge Function `push-reminders` restent sur **Lovable Cloud (Supabase)**.

## 1. Exporter le code vers GitHub

Depuis Lovable : menu **+** (en bas à gauche du chat) → **GitHub → Connect project → Create Repository**.

## 2. Importer sur Vercel

1. Va sur https://vercel.com/new
2. **Import Git Repository** → sélectionne le repo créé.
3. Framework Preset : **Other** (Vercel détectera Vite automatiquement).
4. Build Command : `bun run build` (ou laisse vide → auto).
5. Output Directory : laisse vide (Nitro gère).

## 3. Variables d'environnement à ajouter dans Vercel

**Project Settings → Environment Variables** (toutes en `Production`, `Preview`, `Development`) :

### Côté client (préfixe `VITE_`)
- `VITE_SUPABASE_URL` = `https://sjdhvzjaqarlqcqpkfzd.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = (voir `.env` dans Lovable)
- `VITE_SUPABASE_PROJECT_ID` = `sjdhvzjaqarlqcqpkfzd`

### Côté serveur
- `SUPABASE_URL` = identique à `VITE_SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` = identique à `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` = à récupérer dans Lovable Cloud (Settings → API keys) — **secret, ne jamais préfixer `VITE_`**
- `LOVABLE_API_KEY` = à récupérer dans Lovable Cloud (sera utilisée pour l'IA)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` = utiles uniquement si tu réécris `push-reminders` sur Vercel. Sinon ignore.

## 4. Mettre à jour Supabase Auth (Google OAuth)

Dans Lovable Cloud → **Authentication → URL Configuration** :
- Ajoute ton URL Vercel dans **Redirect URLs** : `https://<ton-app>.vercel.app/**`
- Si tu utilises un domaine custom, ajoute-le aussi.

Sinon le bouton "Continuer avec Google" renverra une erreur "redirect_uri_mismatch".

## 5. Notifications push (sans changement)

L'Edge Function `push-reminders` continue de tourner sur Supabase, déclenchée par `pg_cron` toutes les minutes. **Aucune action requise.**

⚠️ Les utilisateurs déjà abonnés sur `tache-daily.lovable.app` devront se réabonner sur le nouveau domaine Vercel (les `push_subscriptions` sont liées à l'origine du service worker).

## 6. Build technique

`vite.config.ts` contient déjà :
```ts
nitro: { preset: "vercel" }
```
→ Nitro génère automatiquement le bon format (`.vercel/output/`) reconnu par Vercel.

## 7. Tester après déploiement

- [ ] Page d'accueil charge
- [ ] Inscription / connexion email
- [ ] Connexion Google
- [ ] Création de tâche
- [ ] Assistant IA répond
- [ ] Mode hors-ligne (couper le wifi, recharger)
- [ ] PWA installable (icône "Ajouter à l'écran d'accueil")
- [ ] Activer "Notifications en arrière-plan" dans Paramètres

## Rollback

`tache-daily.lovable.app` reste actif en parallèle — tu peux toujours y revenir.