# Notifications de rappel en arrière-plan

Aujourd'hui l'app n'envoie des rappels que lorsqu'elle est ouverte (via `setTimeout` + `Notification` dans `useScheduledReminders`). Dès que l'onglet est fermé, plus rien ne part. Pour recevoir des notifications même app fermée, il faut une vraie architecture **Web Push** : un Service Worker enregistré côté navigateur + un serveur qui pousse les notifications via VAPID au moment voulu.

## Ce qui sera mis en place

### 1. Service Worker dédié aux notifications (`public/sw-push.js`)
- Écoute l'événement `push` et affiche la notification (titre, corps, icône, URL).
- Gère le clic sur la notification → ouvre la tâche / la page "Aujourd'hui".
- Pas de cache d'app shell (on ne touche pas au comportement PWA actuel — conforme aux règles Lovable).

### 2. Stockage des abonnements push
Nouvelle table `push_subscriptions` :
- `user_id`, `endpoint` (unique), `p256dh`, `auth`, `user_agent`, timestamps.
- RLS : l'utilisateur gère uniquement ses propres abonnements ; `service_role` pour le serveur d'envoi.

### 3. Clés VAPID
- Génération d'une paire VAPID (clé publique + privée).
- `VITE_VAPID_PUBLIC_KEY` exposée au client, `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` en secrets serveur.
- Je demanderai ces secrets via l'outil dédié au moment de l'implémentation.

### 4. Abonnement côté client
Dans `Paramètres > Notifications` :
- Nouveau bouton "Activer les rappels en arrière-plan".
- Demande la permission, enregistre le SW, crée la `PushSubscription`, l'enregistre dans Supabase via un `createServerFn`.
- Bouton pour se désabonner (suppression locale + DB).
- Affichage clair de l'état (actif / inactif / non supporté — iOS nécessite l'installation PWA).

### 5. Planificateur serveur (cron toutes les minutes)
Server route `src/routes/api/public/hooks/push-reminders.ts` :
- Récupère les tâches dont `due_date + due_time - default_reminder_minutes` tombe dans la minute en cours, `reminder_enabled = true`, non terminées.
- Récupère les rappels quotidiens dus à cette minute (en respectant `daily_reminder_time` + timezone — voir point 6).
- Pour chaque utilisateur concerné, envoie une notification Web Push à chacun de ses `push_subscriptions` via la lib `web-push`.
- Supprime automatiquement les abonnements retournant 404/410 (expirés).
- Sécurisé par `apikey` (clé anon) comme tout endpoint `/api/public/*`.

Job `pg_cron` : `* * * * *` (toutes les minutes) → POST sur cet endpoint.

### 6. Timezone utilisateur
Ajout d'une colonne `timezone` (IANA, ex. `Europe/Paris`) sur `user_settings`, détectée et stockée au premier chargement via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Indispensable pour que "rappel quotidien à 09:00" soit déclenché à la bonne minute côté serveur.

### 7. Nettoyage du planificateur in-app
- `useScheduledReminders` ne sera plus la source principale, mais conservé en fallback pour les rappels qui tomberaient pendant que l'app est ouverte (évite le doublon en marquant la notification déjà envoyée serveur).
- Anti-doublon simple : nouvelle table `reminder_dispatch_log (task_id, kind, dispatched_at)` avec `UNIQUE(task_id, kind, scheduled_for)` pour que le cron ne renvoie jamais deux fois le même rappel.

## Détails techniques (section pour devs)

- Lib utilisée côté serveur : `web-push` (compatible Workers via fetch + JWT VAPID — on utilisera l'implémentation manuelle fetch si la lib n'est pas Worker-safe, sinon fallback `@block65/webcrypto-web-push`).
- iOS Safari : Web Push fonctionne uniquement si l'app est installée à l'écran d'accueil (PWA). Le manifeste existant suffit, on ajoutera une note dans l'UI.
- Aucune modification du SW d'app-shell (il n'y en a pas aujourd'hui) — `sw-push.js` est isolé.
- Aucune correction de bugs hors scope ; on touche uniquement aux fichiers liés aux notifications + une migration DB.

## Fichiers impactés
- `public/sw-push.js` (nouveau)
- `src/hooks/use-push-notifications.ts` (ajout abonnement/désabonnement Push)
- `src/routes/_authenticated/settings.tsx` (UI activation arrière-plan)
- `src/lib/push.functions.ts` (nouveau : save/delete subscription)
- `src/routes/api/public/hooks/push-reminders.ts` (nouveau : cron handler)
- Migration Supabase : `push_subscriptions`, `reminder_dispatch_log`, colonne `user_settings.timezone`
- Cron `pg_cron` configuré via `supabase--insert`
- Secrets : `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `VITE_VAPID_PUBLIC_KEY`

## Question avant implémentation
Une seule décision UX à confirmer : veux-tu que **l'activation des rappels en arrière-plan soit automatique** dès qu'on autorise les notifications, ou bien gardée derrière un **bouton séparé** "Activer les rappels même app fermée" dans Paramètres ? (par défaut je pars sur bouton séparé, plus transparent pour l'utilisateur).
