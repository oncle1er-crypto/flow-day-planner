# Audit des recommandations

Date de vérification : 31 août 2026. Les preuves automatisées de référence sont les workflows
GitHub `CI` et `Production E2E` exécutés sur `main`.

## Priorités P0 — publication

| Recommandation                                | État     | Preuve                                                                                      |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| Retirer le `service_role` du dépôt et du cron | Appliqué | Le cron lit `push_reminders_cron_secret` depuis Vault et sa commande ne contient aucun JWT. |
| Alimenter les notifications in-app            | Appliqué | `push-reminders` écrit une notification dédupliquée pour chaque dispatch.                   |
| Générer les occurrences récurrentes           | Appliqué | Génération idempotente, rattrapage et tests quotidien/hebdo/mensuel/annuel/personnalisé.    |
| Récupération du mot de passe                  | Appliqué | Envoi du lien, route de réinitialisation et test de lien invalide.                          |
| Tests et garde-fous                           | Appliqué | Typecheck, lint, 39 tests unitaires, E2E connecté, builds Android/iOS et E2E production.    |

## Priorités P1 — fiabilité

| Recommandation                                            | État                                                         | Preuve                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Dates et fuseaux horaires cohérents                       | Appliqué                                                     | Helper partagé et timezone du profil côté serveur/cron.                                                    |
| File hors ligne résiliente                                | Appliqué                                                     | UUID client, tentatives/erreurs conservées, une erreur ne bloque plus les opérations suivantes.            |
| Mutations hors ligne étendues                             | Appliqué                                                     | Tâches, sous-tâches, habitudes, objectifs, focus, catégories et lecture des notifications.                 |
| Frontière d’erreur et états de chargement                 | Appliqué au niveau global et sur les écrans réseau critiques | Boundary TanStack avec remontée d’erreur; skeleton/erreur explicite pour les notifications.                |
| Export et suppression de compte                           | Appliqué                                                     | Import/export JSON et RPC de suppression réservé au rôle `authenticated`.                                  |
| Ne jamais mettre en cache les réponses Supabase partagées | Appliqué                                                     | Service worker applicatif sans cache des API authentifiées et purge du cache utilisateur à la déconnexion. |

## Recommandations de qualité

- Branding Flow Day Planner harmonisé, métadonnées par route publique et vraies icônes PWA 192/512.
- Agrégat SQL de gamification pour éviter le chargement intégral de l’historique.
- Catégories administrables, import de sauvegarde, en-têtes CSP/HTTP et validation stricte de l’IA.
- Bundle client initial découpé sous le seuil d’avertissement.

## Validations externes encore requises

Ces points ne peuvent pas être prouvés par le dépôt ou un navigateur CI :

1. confirmer dans l’administration Lovable/Supabase que l’ancienne clé `service_role`, autrefois
   présente dans l’historique Git, a bien été révoquée/rotée ; l’application et le cron ne
   l’utilisent plus ;
2. effectuer au moins un test de notification réelle sur un iPhone avec la PWA installée et sur un
   appareil Android (veille, application fermée, clic sur la notification) ;
3. fournir l’identité légale de l’éditeur et une adresse de contact avant de publier des pages
   Conditions et Confidentialité juridiquement complètes.
