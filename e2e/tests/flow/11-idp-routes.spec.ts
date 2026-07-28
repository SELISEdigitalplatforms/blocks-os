import { test, expect } from "../../support/test-base";
import { enterProject } from "../../support/navigation";
import { expectRedirect, openFirstTableRow, openScopedRoute } from "../../support/flow-routes";

test("11 - covers IDP settings, aliases, roles, permissions, and detail routes", async ({ page }) => {
  test.setTimeout(240_000);
  const itemId = await enterProject(page);

  await openScopedRoute(page, itemId, "idp/settings", [
    "Auth Configuration",
    "Configure authentication policies, token validity, account lockout rules, and certificate settings.",
  ]);

  await openScopedRoute(page, itemId, "idp/oidc-template", [
    /OIDC template/i,
    /Configure your OIDC template settings/i,
  ]);

  await expectRedirect(
    page,
    `/app/${itemId}/idp/role`,
    new RegExp(`/app/${itemId}/idp/roles`),
    ["Roles", "Create and manage roles that group permissions for users"],
  );
  await expectRedirect(
    page,
    `/app/${itemId}/idp/role-detail`,
    new RegExp(`/app/${itemId}/idp/roles`),
    ["Roles"],
  );

  await page.goto(`/app/${itemId}/idp/roles`);
  await openFirstTableRow(page, page.getByText("No roles found").first());
  await page.waitForURL(new RegExp(`/app/${itemId}/idp/role-detail/[^/]+$`), {
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "Edit Permissions" })).toBeVisible({
    timeout: 30_000,
  });

  await expectRedirect(
    page,
    `/app/${itemId}/idp/permission`,
    new RegExp(`/app/${itemId}/idp/permissions`),
    ["Permissions", "Define and manage granular permissions for access control"],
  );
  await expectRedirect(
    page,
    `/app/${itemId}/idp/permission-detail`,
    new RegExp(`/app/${itemId}/idp/permissions`),
    ["Permissions"],
  );

  await openScopedRoute(page, itemId, "idp/permission-detail/new", ["New Permission"]);

  await page.goto(`/app/${itemId}/idp/permissions`);
  await openFirstTableRow(page, page.getByText("No permission found").first());
  await page.waitForURL(new RegExp(`/app/${itemId}/idp/permission-detail/[^/]+$`), {
    timeout: 30_000,
  });
  await expect(page.getByText(/Built In|Custom/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Save|Update/i }).first()).toBeVisible({
    timeout: 30_000,
  });
});
