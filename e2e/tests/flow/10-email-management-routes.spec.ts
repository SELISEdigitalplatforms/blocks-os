import { test, expect } from "../../support/test-base";
import { enterProject } from "../../support/navigation";
import { openFirstTableRow, openScopedRoute } from "../../support/flow-routes";

test("10 - covers Email Management list, create, detail, edit, and usage routes", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const itemId = await enterProject(page);

  await openScopedRoute(page, itemId, "email-management", [
    "Email Templates",
    "Create, review, and manage reusable email templates for application communication.",
  ]);

  await openScopedRoute(page, itemId, "email-management/new-communication", [
    "Basic information",
    "Name, mail configuration, and subject line",
  ]);

  await page.goto(`/app/${itemId}/email-management`);
  await openFirstTableRow(page, page.getByRole("button", { name: "Add Template" }));
  await page.waitForURL(new RegExp(`/app/${itemId}/email-management/communications/[^/]+$`), {
    timeout: 30_000,
  });
  await expect(page.getByText("Template").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Details").first()).toBeVisible({ timeout: 30_000 });

  const communicationDetailUrl = page.url();
  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.waitForURL(new RegExp(`/app/${itemId}/email-management/communications/[^/]+/edit$`), {
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Preview").first()).toBeVisible({ timeout: 30_000 });

  await page.goto(`/app/${itemId}/email-management`);
  await page.getByRole("tab", { name: /Inbound|Usage/i }).first().click();
  await openFirstTableRow(page, page.getByText("Subject").first());
  await page.waitForURL(new RegExp(`/app/${itemId}/email-management/usage/[^/]+$`), {
    timeout: 30_000,
  });
  await expect(page.getByText("Subject").first()).toBeVisible({ timeout: 30_000 });

  await page.goto(communicationDetailUrl);
  await expect(page).toHaveURL(new RegExp(`/app/${itemId}/email-management/communications/[^/]+$`));
});
