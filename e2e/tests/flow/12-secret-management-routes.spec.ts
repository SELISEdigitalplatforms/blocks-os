import { test, expect } from "../../support/test-base";
import { enterProject } from "../../support/navigation";
import { expectRedirect, openFirstTableRow, openScopedRoute } from "../../support/flow-routes";

test("12 - covers Secrets & Configs child routes, retired redirect, and OIDC branding", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const itemId = await enterProject(page);

  await expectRedirect(page, `/app/${itemId}`, new RegExp(`/app/${itemId}/dashboard`), []);

  const routes: Array<[string, (string | RegExp)[]]> = [
    ["secret-management/captcha", ["Captcha", "Bot protection configuration"]],
    [
      "secret-management/client-credentials",
      ["Client Credentials", "OAuth client credentials for service-to-service access"],
    ],
    ["secret-management/email", ["Email", "Email provider configuration"]],
    [
      "secret-management/external-idp",
      ["External IdP", "External identity providers & certificates"],
    ],
    [
      "secret-management/identity-providers",
      ["Identity Provider", "Federated external identity providers"],
    ],
    ["secret-management/mfa", ["MFA", "Multi-factor authentication settings"]],
    ["secret-management/notification", ["Notification", "Push & notification settings"]],
    ["secret-management/oidc", ["OIDC", "OpenID Connect configuration"]],
    ["secret-management/sso", ["SSO", "Single sign-on providers"]],
    ["secret-management/storage", ["Storage", "File and object storage"]],
  ];

  for (const [path, assertions] of routes) {
    await openScopedRoute(page, itemId, path, assertions);
  }

  await expectRedirect(
    page,
    `/app/${itemId}/secret-management/managed-services`,
    /\/app\/secret-management\/my-services/,
    ["My Services"],
  );

  await page.goto(`/app/${itemId}/secret-management/oidc`);
  await openFirstTableRow(
    page,
    page.getByRole("button", { name: "Template" }).or(page.getByLabel("Template")).first(),
  );

  if (!/\/branding$/.test(page.url())) {
    await page.getByRole("button", { name: "Template" }).or(page.getByLabel("Template")).first().click();
  }

  await page.waitForURL(new RegExp(`/app/${itemId}/secret-management/oidc/[^/]+/branding$`), {
    timeout: 30_000,
  });
  await expect(page.getByText(/Template|Branding|Login preview/i).first()).toBeVisible({
    timeout: 30_000,
  });
});
