# Checklist production

- [x] CI GitHub verte
- [ ] Révocation/rotation de l’ancienne clé `service_role` confirmée dans l’administration
- [x] Secret de cron stocké dans Supabase Vault
- [x] Cron Vault actif, sans JWT embarqué, et appels Edge Function HTTP 200
- [x] Rappels dédupliqués couverts par les tests
- [x] Réinitialisation de mot de passe testée
- [x] Récurrence quotidienne/hebdo/mensuelle/annuelle/personnalisée testée
- [x] Builds Android et simulateur iOS validés en CI
- [ ] Notifications validées sur appareils physiques iOS et Android, application fermée
- [x] E2E connecté validé contre la production Vercel

Voir `recommendations-audit.md` pour la traçabilité détaillée et les limites de validation externe.
