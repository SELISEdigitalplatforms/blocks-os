import { expect } from "@playwright/test";
import { test } from "../../support/test-base";
import {
  createProject,
  deleteProject,
  ensureConsole,
} from "../../support/create-and-delete-project";
import { e2eBaseUrl } from "../../support/env";

/**
 * #606 — Per-tenant, environment-correct JWT issuer on project creation.
 *
 * Happy-path proof on the PR preview: creating a Development project must
 * succeed (IsSuccess, no iam_configuration error) when the deployment has
 * FrontendRuntime:BLOCKS_IAM_BASE_URL configured. Unit tests cover the issuer
 * string shape, fail-closed validation, and certificate DN decoupling; full
 * mongosh/IAM token decode (§7 steps 2–11) needs root-DB access outside Playwright.
 */
test.describe("jwt issuer on project create (#606)", () => {
  test("Create project succeeds with configured IAM base URL (H1 smoke)", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    // os-setup may leave the suite session locked in a shared project; leave it
    // so /app/console (and createProject) can paint the project grid.
    await page.goto(`${e2eBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" });
    const leaveButton = page.getByRole("button", { name: /Leave Test Project/i });
    if (await leaveButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await leaveButton.click();
      await expect(leaveButton).toHaveCount(0, { timeout: 30_000 });
    }
    await ensureConsole(page);

    let createBody: {
      isSuccess?: boolean;
      IsSuccess?: boolean;
      errors?: Record<string, string>;
      Errors?: Record<string, string>;
    } | null = null;

    page.on("response", async (response) => {
      if (!/\/api\/Project\/Create\b/i.test(response.url())) return;
      if (response.request().method() !== "POST") return;
      try {
        createBody = await response.json();
      } catch {
        // ignore non-JSON
      }
    });

    const created = await createProject(page);

    expect(createBody, "Project/Create response should have been captured").not.toBeNull();
    const success = createBody!.isSuccess ?? createBody!.IsSuccess;
    const errors = createBody!.errors ?? createBody!.Errors ?? {};
    expect(success, `Create should succeed; errors=${JSON.stringify(errors)}`).toBe(true);
    expect(errors).not.toHaveProperty("iam_configuration");
    expect(created.itemId).toBeTruthy();
    expect(created.tenantGroupId).toBeTruthy();

    await deleteProject(page, created.projectName).catch(() => {
      /* best-effort — globalTeardown also sweeps orphans */
    });
  });
});
