/*
 * Seed data for subscriptions and billing.
 *
 *   mongosh "<connection-string>/<rootDb>" scripts/seed-subscription.js
 *
 * Everything here lives in the ROOT database. No subscription data is ever written to a tenant
 * database, because a ceiling is a billing record and an environment must not be able to rewrite
 * its own.
 *
 * Safe to run twice: every write is an upsert or an index creation.
 */

const GROUP = "grp_REPLACE_ME";        // the project (tenant group) you are seeding
const OWNER = "usr_REPLACE_ME";        // a user with an IsCreator row in ProjectPeoples

// ── 1. Indexes ───────────────────────────────────────────────────────────────
// The unique one is not an optimisation: it is what makes a double-click one charge instead of
// two. The app creates these at start-up as well; doing it here means they exist before it runs.

db.SubscriptionOrders.createIndex(
  { TenantGroupId: 1, IdempotencyKey: 1 },
  { unique: true, name: "ux_group_idempotency" },
);
db.SubscriptionOrders.createIndex({ State: 1, UpdatedAtUtc: 1 }, { name: "ix_state_updated" });
db.ProcessedPaymentNotifications.createIndex(
  { PspReference: 1 },
  { unique: true, name: "ux_psp_reference" },
);
db.Invoices.createIndex({ Number: 1 }, { unique: true, name: "ux_invoice_number" });

// ── 2. Adyen credentials ─────────────────────────────────────────────────────
// NOT seeded here, and deliberately so.
//
// Values are read through ISecretValueStore, which is Key Vault wherever one is configured and the
// database only as a fallback. Writing a row by hand reaches whichever of the two this environment
// is NOT using about half the time, and the two are invisible to each other — so a seeded value can
// look present and never be read.
//
// Set it the supported way instead, under the secret id `billing-adyen`, with this JSON as its
// value:
//
//   {
//     "MerchantAccount": "YourMerchantAccountTEST",
//     "ApiKey":          "AQE...",
//     "ApiBaseUrl":      "https://checkout-test.adyen.com/v71",
//     "HmacKey":         "<hex hmac key from Adyen>",
//     "ClientKey":       "test_...",
//     "IsLive":          false
//   }
//
// IsLive must stay false outside production: the service refuses live credentials anywhere else
// rather than charging a real card from staging.
//
// If this environment genuinely uses the database value store, the value belongs in the SEPARATE
// `SecretStore` database, collection `SecretValues` — never in `Secrets`, which holds metadata and
// by design never holds a value:
//
//   mongosh "<connection>/SecretStore" --eval '"'"'
//     db.SecretValues.replaceOne(
//       { SecretId: "billing-adyen" },
//       { ItemId: "billing-adyen", SecretId: "billing-adyen", Value: "<the json above>",
//         LastUpdatedDate: new Date() },
//       { upsert: true })'"'"'ded

// ── 3. Delegable menu ────────────────────────────────────────────────────────
// Without this, subscription::view can never be granted to a contributor. Owners pass regardless,
// which is exactly why the gap is invisible until someone tries to delegate.
//
// The app seeds this too; it is here so the document is right from the first boot.

// The catalogue lives in this same collection now — `catalogue:active` points at a version held
// under `catalogue:version:<version>`. The app publishes it on first start from the shipped JSON;
// nothing to seed here.

const catalogKey = "project-access-catalog";
const existing = db.keyValueStores.findOne({ _id: catalogKey });
const catalog = (existing && existing.Value) || {};

if (!catalog.subscription) {
  catalog.subscription = ["view"];
  db.keyValueStores.updateOne(
    { _id: catalogKey },
    { $set: { _id: catalogKey, Value: catalog } },
    { upsert: true },
  );
}

// ── 4. A subscription to look at ─────────────────────────────────────────────
// Optional. Only recurring things belong here — environments, and resource ceilings that are rent
// while held. Counter units are bought once and carry until spent, so they never appear.

db.ProjectSubscriptions.updateOne(
  { _id: GROUP },
  {
    $set: {
      _id: GROUP,
      TenantGroupId: GROUP,
      Market: "CHF",
      State: "active",
      Lines: [
        { Kind: "environment", Environment: "dev", Meter: "", Label: "Development", Units: 0, Amount: 0 },
        { Kind: "environment", Environment: "prod", Meter: "", Label: "Production", Units: 0, Amount: 300 },
      ],
      NextChargeAtUtc: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      LastChargedAtUtc: new Date(),
      CarriedBalance: 0,
      FailedAttempts: 0,
      LastFailureReason: "",
      CreatedAtUtc: new Date(),
      UpdatedAtUtc: new Date(),
    },
  },
  { upsert: true },
);

// ── 5. One paid invoice ──────────────────────────────────────────────────────

db.Invoices.updateOne(
  { Number: "INV-2026-09-0001" },
  {
    $set: {
      Number: "INV-2026-09-0001",
      TenantGroupId: GROUP,
      OrderId: "",
      Market: "CHF",
      Subtotal: 300,
      Vat: 24.3,
      Total: 324.3,
      CarriedIn: 0,
      Lines: [{ Label: "Production", Environment: "prod", Units: 0, Amount: 300, Billing: "rent" }],
      State: "paid",
      ProviderReference: "psp_seed",
      IssuedAtUtc: new Date(),
      PaidAtUtc: new Date(),
    },
  },
  { upsert: true },
);

print("Seeded. Owner " + OWNER + " on project " + GROUP);
print("Still to do outside this script:");
print("  - set the billing-adyen secret through the secret store (see section 2)");
print("  - register blocks-os::billing::read and blocks-os::billing::manage in IAM");
print("  - create the two notification configurations in blocks-logic");
