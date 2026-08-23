# Politique minimale de secrets

- Aucun `service_role`, token privé, secret VAPID ou mot de passe dans Git.
- Les secrets serveur vivent dans Supabase Vault ou dans les secrets de déploiement.
- Toute valeur exposée dans Git est considérée compromise et doit être rotée.
- Les migrations ne doivent référencer que des noms de secrets, jamais leurs valeurs.
