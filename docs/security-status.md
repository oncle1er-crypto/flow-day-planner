# Security status

The hardcoded `service_role` JWT has been removed from the current repository tree on the ChatGPT finishing branch. A Vault-based cron migration replaces the unsafe schedule. The previously exposed key still requires rotation because Git history is immutable evidence of exposure.
