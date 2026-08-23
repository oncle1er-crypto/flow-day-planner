# Rotation obligatoire de la clé Supabase compromise

Une ancienne migration du dépôt a exposé publiquement un JWT `service_role` Supabase. Le secret a été retiré de l'arbre courant, mais cela **ne révoque pas** la valeur déjà exposée dans l'historique Git.

## Action manuelle indispensable avant production

1. Dans le projet Supabase `sjdhvzjaqarlqcqpkfzd`, révoquer/faire tourner la clé `service_role` exposée.
2. Ne jamais copier la nouvelle clé dans GitHub, un fichier `.env` versionné ou une migration SQL.
3. Enregistrer la **nouvelle** clé dans Supabase Vault sous le nom exact :
   `push_reminders_service_role_jwt`
4. Appliquer la migration `20260823002000_secure_push_cron_vault.sql`.
5. Vérifier que le job `push-reminders-minutely` existe et qu'il appelle l'Edge Function avec succès.
6. Vérifier ensuite qu'un rappel crée une seule ligne dans `notifications` et une seule entrée dans `reminder_dispatch_log`.

## Recommandation supplémentaire

Le dépôt ayant été public pendant l'exposition, considérer l'ancienne clé comme définitivement compromise même si l'historique Git est réécrit. Une rotation reste obligatoire.
