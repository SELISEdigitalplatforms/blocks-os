# Quota / billing seed

Everything the purchase flow (create project → checkout → pay → order progress) needs in the database.

| File | Goes to | Collection | Why |
|---|---|---|---|
| `01-permissions.json` | OS root tenant DB | `Permissions` | `[ProtectedEndPoint]` on Billing, Checkout, Usage, Catalogue |
| `02-notification-configurations.json` | OS root tenant DB (read by blocks-logic) | `NotificationConfigurations` | live order progress / outcome push |
| `03-project-access-catalog.json` | OS root tenant DB | `keyValueStores` (merged) | lets an owner grant `subscription::view` |
| `04-billing-adyen.secret.template.json` | **Key Vault** secret `billing-adyen` | — | Adyen; never written to Mongo by hand |

```
DRY_RUN=1 mongosh "<connection>/<OS root tenant db>" scripts/seed/quota/seed.js   # report only
          mongosh "<connection>/<OS root tenant db>" scripts/seed/quota/seed.js
```

- Safe to re-run: upserts on `Resource` / `Name` / `_id`; existing keys in the access catalog are kept.
- New permissions copy the `Roles` of `blocks-os::project::projects` (override: `ROLE_SOURCE=<resource>`).
  Roles are set on insert only, so a later change in IAM survives a re-run.
- Not seeded: the catalogue (the API publishes `plan-catalogue.json` on first start) and quota rows
  (written when an order is built, or by "Sync with catalogue" on Usage).
