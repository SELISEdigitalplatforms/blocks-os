/*
 * Quota / billing seed — everything the purchase flow needs in the database to run end to end.
 *
 *   mongosh "<connection-string>/<OS root tenant database>" scripts/seed/quota/seed.js
 *   DRY_RUN=1 mongosh … scripts/seed/quota/seed.js     # report only, writes nothing
 *
 * Run it against the database of the OS root tenant: the tenant whose x-blocks-key the console
 * sends. Genesis reads `Permissions` there (ProtectedEndpointAccessHandler), blocks-logic reads
 * `NotificationConfigurations` there (the order push carries that key), and blocks-os keeps
 * `keyValueStores`, orders and invoices there.
 *
 * Safe to run twice: every write is an upsert, keyed on the natural key (Resource, Name, _id).
 * Not seeded on purpose:
 *   - the catalogue: the API publishes plan-catalogue.json + price-book.json on first start;
 *   - quota rows: written when an order is built, or by "Sync with catalogue" on Usage;
 *   - the Adyen secret: 04-billing-adyen.secret.template.json is the VALUE for the Key Vault
 *     secret `billing-adyen`, set through the secret store — never written here.
 */

const DRY_RUN = (process.env.DRY_RUN ?? "") === "1";
// Permissions get the roles of an existing OS permission, so whoever can use the console today can
// use billing tomorrow. Point this at another resource to copy different roles.
const ROLE_SOURCE = process.env.ROLE_SOURCE ?? "blocks-os::project::projects";
const fs = require("fs");
const path = require("path");
const dir = path.dirname(__filename) + path.sep;
const read = (name) => JSON.parse(fs.readFileSync(dir + name, "utf8"));
const now = new Date();
const write = (label, fn) => {
  if (DRY_RUN) {
    print(`  [dry run] ${label}`);
    return;
  }
  fn();
  print(`  ${label}`);
};

// ── 1. Permissions ───────────────────────────────────────────────────────────
print("Permissions");
const source = db.Permissions.findOne({ Resource: ROLE_SOURCE, OrganizationId: "default" });
const sourceRoles = source?.Roles ?? [];
if (!source) {
  print(`  ! ${ROLE_SOURCE} not found — new permissions get no roles; assign them in IAM.`);
} else if (sourceRoles.length === 0) {
  print(`  ! ${ROLE_SOURCE} has no roles — new permissions get none; assign them in IAM.`);
}
for (const p of read("01-permissions.json")) {
  const existing = db.Permissions.findOne({ Resource: p.Resource, OrganizationId: "default" });
  const { _id, Roles, ...fields } = p;
  write(`${existing ? "update" : "insert"} ${p.Resource}`, () =>
    db.Permissions.updateOne(
      { Resource: p.Resource, OrganizationId: "default" },
      {
        $set: { ...fields, LastUpdatedDate: now },
        // Roles are only chosen on insert: an admin's later change in IAM must survive a re-run.
        $setOnInsert: { _id, CreatedDate: now, Roles: sourceRoles.length ? sourceRoles : Roles },
      },
      { upsert: true },
    ),
  );
}

// ── 2. blocks-logic notification configurations (order progress + outcome) ──
print("NotificationConfigurations");
for (const c of read("02-notification-configurations.json")) {
  const { _id, ...fields } = c;
  const existing = db.NotificationConfigurations.findOne({ Name: c.Name });
  write(`${existing ? "update" : "insert"} ${c.Name} → ${c.NotifyMethod}`, () =>
    db.NotificationConfigurations.updateOne(
      { Name: c.Name },
      { $set: { ...fields, LastUpdatedDate: now }, $setOnInsert: { _id, CreatedDate: now } },
      { upsert: true },
    ),
  );
}

// ── 3. Project access catalog (lets an owner grant "subscription::view") ────
print("keyValueStores");
const catalog = read("03-project-access-catalog.json");
const current = db.keyValueStores.findOne({ _id: catalog._id });
const value = { ...(current?.Value ?? {}) };
for (const [menu, actions] of Object.entries(catalog.merge)) {
  value[menu] = [...new Set([...(value[menu] ?? []), ...actions])];
}
write(`merge ${catalog._id}: ${JSON.stringify(catalog.merge)}`, () =>
  db.keyValueStores.updateOne({ _id: catalog._id }, { $set: { Value: value } }, { upsert: true }),
);

// ── 4. Indexes (the app creates them at start-up too; here so they exist first) ──
print("Indexes");
write("SubscriptionOrders ux_group_idempotency (unique) + ix_state_updated", () => {
  db.SubscriptionOrders.createIndex({ TenantGroupId: 1, IdempotencyKey: 1 }, { unique: true, name: "ux_group_idempotency" });
  db.SubscriptionOrders.createIndex({ State: 1, UpdatedAtUtc: 1 }, { name: "ix_state_updated" });
});
write("ProcessedPaymentNotifications ux_psp_reference (unique)", () =>
  db.ProcessedPaymentNotifications.createIndex({ PspReference: 1 }, { unique: true, name: "ux_psp_reference" }),
);
write("Invoices ux_invoice_number (unique)", () =>
  db.Invoices.createIndex({ Number: 1 }, { unique: true, name: "ux_invoice_number" }),
);

print(DRY_RUN ? "\nDry run: nothing written." : "\nSeeded.");
print("Still outside this script: set Key Vault secret `billing-adyen` (04-billing-adyen.secret.template.json).");
