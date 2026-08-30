# CI GitHub

La branche `chatgpt/**` et les pull requests vers `main` exécutent automatiquement :

1. `npm ci`
2. audit des dépendances de production
3. typage et lint
4. tests unitaires
5. build de production
6. tests navigateur connectés à Supabase
7. build Android
8. build simulateur iOS

Après fusion, le workflow Production E2E attend le déploiement Vercel du commit exact puis rejoue
la suite connectée sur `https://plannificateur.vercel.app`.
