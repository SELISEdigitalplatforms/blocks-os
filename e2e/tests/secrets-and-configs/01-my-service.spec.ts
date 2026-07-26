import { test, expect } from "../../support/test-base";

// Secrets & Configs > My Services flow.
//
// Routes & elements these specs target (verified against the codebase):
//   /app/secret-management/my-services  →  <PageHeader> titled "My Services"
//     - header actions: [Setup Guide] [Register Service]
//     - sidebar nav group: "Secrets & Keys" with item "My Services"
//   The "Register Service" dialog contains:
//     - Service Name (Input, placeholder "Enter name")
//     - Type (Select: frontend / backend)
//     - Tags (ChipsInput: tag chips + "Type and press enter" input)
//     - Save (submit) | Cancel
//   A registered service renders as a service-card with:
//     - h3 = service name, Badge = serviceType
//     - LinkButton "Logs" / LinkButton "Traces"
//
// No project context is required for secret-management, so we don't depend
// on requireProject() here — the global project store still has whatever was
// last selected.

test("secrets&config-myservice", async ({ page }) => {
  await page.goto("/app/secret-management/my-services");

  // Header on the desktop sidebar carries the page title.
  await expect(page.getByRole("heading", { name: "My Services" })).toBeVisible();

  // Open the Register Service dialog.
  await page.getByRole("button", { name: "Register Service" }).click();
  const dialog = page.getByRole("dialog");

  // Service Name — the field is labelled "Service Name *" (the * is part of the
  // label text rendered by the FormLabel).
  await dialog.getByLabel(/^Service Name/).fill("Test Service");

  // Tags — the chip input shows the placeholder "Type and press enter".
  await dialog.getByPlaceholder("Type and press enter").click();

  await dialog.getByRole("button", { name: "Save" }).click();

  // The newly-registered service card shows up with the Logs link button.
  const card = page.locator("h3", { hasText: "Test Service" }).locator("..");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("link", { name: "Logs" }).click();
});

test("myservice-setupguide", async ({ page }) => {
  await page.goto("/app/secret-management/my-services");

  // The Setup Guide button only renders while the current path is "my-services".
  await expect(page.getByRole("heading", { name: "My Services" })).toBeVisible();

  await page.getByRole("button", { name: "Setup Guide" }).click();

  // The guide opens as a dialog. Assert it rendered — its body starts with the
  // "My Services Overview" heading (guideline-docs.tsx).
  const guide = page.getByRole("dialog");
  await expect(guide.getByRole("heading", { name: "My Services Overview" })).toBeVisible();
});
