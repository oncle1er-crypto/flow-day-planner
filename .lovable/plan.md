# Audit historique (conservé pour traçabilité)

> Ce document décrit l'état initial de juin 2026 et ne représente plus l'application actuelle.
> La récurrence, les notifications, la récupération de mot de passe, l'export, la suppression de
> compte et les tests ont depuis été implémentés. Utiliser `docs/development-status.md`,
> `docs/production-checklist.md` et les workflows GitHub comme sources de vérité actuelles.

Note préalable : le nom dans le code est **Smart Daily Tasks** (`public/manifest.webmanifest`, `src/routes/__root.tsx`), pas « Flow Day Planner ». À trancher avant publication.

## Ce qui est réellement fonctionnel

- **Auth email/mot de passe** : inscription + connexion (`src/routes/auth.tsx`), garde d'accès unique et correcte (`src/routes/_authenticated/route.tsx`, `ssr:false`), redirection d'entrée (`src/routes/index.tsx`).
- **Tâches / sous-tâches / catégories** : CRUD complet, priorités, filtres (`src/hooks/use-tasks.ts`, `use-subtasks.ts`, `use-categories.ts`).
- **Habitudes, objectifs, focus** : CRUD + streaks + Pomodoro persisté (`use-habits.ts`, `use-goals.ts`, `use-focus-sessions.ts`, `focus.tsx`).
- **Historique / bilan** : calculs 100 % côté client sur données réelles (`history.tsx`).
- **Base de données** : 11 migrations, toutes les tables ont GRANTs + RLS `TO authenticated` scoping `auth.uid()`, triggers `updated_at`, seed catégories à l'inscription.
- **Gamification** : validation serveur des badges via `src/lib/achievements.functions.ts` (INSERT client révoqué).
- **Offline** : cache React Query persisté en IndexedDB + file de sync (`router.tsx`, `offline-db.ts`, `sync-queue.ts`), App Shell PWA (`vite.config.ts`).
- **Assistant IA** : opérationnel via Lovable AI, erreurs API masquées (`assistant.functions.ts`).

## Partiel / simulé / non branché

- **Centre de notifications in-app** : la page lit `notifications`, mais **aucun code n'insère jamais de ligne** (ni client, ni `supabase/functions/push-reminders/index.ts` qui n'écrit que dans `reminder_dispatch_log`). Écran vide par construction.
- **Récurrence des tâches** : colonnes `recurrence`, `recurrence_config`, `recurrence_end_date` en base, mais **aucune logique de génération** (`recurrence` n'apparaît que dans l'affichage `TaskCard.tsx`). Fonctionnalité promise, non implémentée.
- **Rappels locaux** : `useScheduledReminders` ne planifie que si l'onglet reste ouvert (`setTimeout`), fenêtre 24 h, et parse `new Date(\`${due_date}T${time}\`)` → décalage selon le fuseau de l'appareil.
- **Push en arrière-plan** : chaîne complète (VAPID, `sw-push.js`, cron minute), mais dépend d'un cron appelant une URL et un token en dur (voir P0).
- **Bilan hebdomadaire « chaque fin de semaine »** : consultable à la demande, mais **aucune notification/déclenchement automatique** de fin de semaine.
- **Profil** : édition nom/téléphone + déconnexion. Pas de reset mot de passe, pas de suppression de compte, pas d'avatar (aucun bucket storage).
- **Tests automatisés** : **aucun** (pas de vitest, aucun fichier de test).

## Liste priorisée

### P0 — bloquant publication

1. **Clé `service_role` en clair dans le dépôt** — `supabase/migrations/20260625080054_*.sql` contient le JWT service_role dans le `cron.schedule` (header Authorization). Fuite totale de la base si le code est exporté/publié sur GitHub. → remplacer par un secret Vault (`vault.decrypted_secrets`) ou un endpoint `/api/public/push-reminders` protégé par un secret partagé.
2. **Notifications in-app fantômes** — table jamais alimentée. Soit brancher l'insertion (edge function / server fn au moment du rappel), soit retirer l'onglet.
3. **Récurrence non implémentée** — soit implémenter la génération d'occurrences, soit masquer le champ dans `TaskFormDialog` pour ne pas promettre une fonction inexistante.
4. **Reset de mot de passe absent** — un utilisateur qui oublie son mot de passe est définitivement bloqué (`auth.tsx` n'a aucun `resetPasswordForEmail`).
5. **Aucun test, aucun garde-fou de non-régression** avant mise en production.

### P1 — fiabilité / cohérence

6. **Fuseaux horaires** — `use-push-notifications.ts` et `use-gamification.ts`/`achievements.functions.ts` utilisent `toISOString().slice(0,10)`, ce qui décale les dates hors UTC ; `dates.ts` est correct. Uniformiser sur un helper unique.
7. **File de sync incomplète** — `SyncOp.tempId` est déclaré mais jamais exploité (`sync-queue.ts`) : une tâche créée hors-ligne puis modifiée hors-ligne produit un `update` sur un id temporaire → op qui échouera et **bloque toute la file** (`break` au premier échec, sans compteur de tentatives ni mise en quarantaine).
8. **Sous-tâches / objectifs / focus / notifications non offline** — seules `tasks` et `habits` passent par la file ; les autres mutations échouent silencieusement hors-ligne.
9. **Aucune frontière d'erreur par route** — seul `__root.tsx` a `errorComponent`. Une erreur réseau sur une page casse tout l'écran au lieu du bloc concerné. Idem : aucun état `pending`/skeleton, les listes affichent « vide » pendant le chargement (`data: items = []`).
10. **`suppression de compte` / RGPD** — pas de suppression de compte ni d'export de données.
11. **Cache Supabase REST en `NetworkFirst`** (`vite.config.ts`) : des réponses de données utilisateur sont stockées dans le Cache Storage, non purgées à la déconnexion (fuite locale sur appareil partagé).

### P2 — UX & qualité

12. **Nom d'app incohérent** (Smart Daily Tasks vs Flow Day Planner) sur manifest, `<title>`, page auth.
13. **Barre de navigation à 6 entrées** + assistant relégué : navigation dense sur petit écran (`BottomNav.tsx`).
14. **Pas de `head()` par route** ; tout hérite de `__root`. Peu critique (app privée) mais à ajuster pour `/auth` et `/`.
15. **Fichier `calendar.tsx`** finit par un commentaire résiduel `// fix unused import` ; vue calendrier limitée à la semaine (pas de vue mois).
16. **Requêtes gamification non paginées** : `habit_logs` et `focus_sessions` chargés intégralement à chaque page (via `AppShell`), coût croissant avec l'usage.
17. **Onboarding absent** : premier lancement = écran vide sans guidage.

### P3 — polish

18. Icônes PWA : une seule taille `icon-512.png`, pas de maskable dédiée ni de screenshots manifest.
19. Pas de page « Conditions / Confidentialité » alors que `auth.tsx` y fait référence.
20. Pas de monitoring produit (aucun suivi d'erreurs applicatif côté client hors reporting Lovable).
21. `sitemap[.]xml.ts` pour une app 100 % privée : peu utile, à vérifier.

## Plan de finition par vagues

**Vague 1 — Sécurité & blocages (P0)**
Retirer le service_role du dépôt (secret Vault ou endpoint signé), rebrancher ou retirer les notifications in-app, décider récurrence (implémenter ou masquer), ajouter le flux « mot de passe oublié » + page de réinitialisation.

**Vague 2 — Robustesse données (P1 6-8, 11)**
Helper de date/fuseau unique, refonte de la file de sync (résolution des tempId, retries, quarantaine, badge d'échec), extension de la file aux sous-tâches/objectifs/focus, purge des caches Supabase à la déconnexion.

**Vague 3 — Robustesse UI (P1 9-10, P2 17)**
`errorComponent` + skeletons de chargement par route, distinction « vide » vs « chargement », suppression de compte + export JSON, onboarding en 3 écrans.

**Vague 4 — Tests & CI**
Ajouter Vitest : utilitaires (`habit-utils`, `goal-utils`, `gamification`, dates), file de sync (mock IndexedDB), validateurs Zod des server fns ; puis un parcours Playwright bout-en-bout (inscription → tâche → complétion → bilan → hors-ligne/retour).

**Vague 5 — Publication**
Harmonisation du nom et du branding, icônes/maskable/screenshots, pages légales, allègement de la navigation, vérification finale du build et du parcours push sur appareil réel (iOS = installation à l'écran d'accueil obligatoire).

## Détails techniques de référence

- Aucun problème de build : `/tmp/observability/build-errors.log` = `build OK`.
- RLS vérifiée sur les 12 tables : toutes en `TO authenticated`, `reminder_dispatch_log` en lecture seule, `user_achievements` sans INSERT client — posture correcte.
- Pile : TanStack Start + React 19, React Query persisté, `vite-plugin-pwa`, Lovable Cloud (Supabase) ; une seule edge function (`push-reminders`), le reste en `createServerFn`.
