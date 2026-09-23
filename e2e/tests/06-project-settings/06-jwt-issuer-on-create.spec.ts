import { expect } from "@playwright/test";
import { test } from "../../support/test-base";
import {
  createProject,
  deleteProject,
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
async function dismissSessionLockIfPresent(page: import("@playwright/test").Page) {
  await page.goto(`${e2eBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" });

  const leaveButton = page.getByRole("button", { name: /Leave .+Project/i });
  const consoleHeading = page.getByRole("heading", {
    name: /Your Blocks Projects|Welcome to SELISE Blocks/,
  });

  // Session lock and console heading are mutually exclusive; wait for either.
  await Promise.race([
    leaveButton.waitFor({ state: "visible", timeout: 45_000 }),
    consoleHeading.waitFor({ state: "visible", timeout: 45_000 }),
  ]).catch(() => {
    /* fall through — createProject/ensureConsole will surface a clearer error */
  });

  if (await leaveButton.isVisible().catch(() => false)) {
    await leaveButton.click();
    await expect(consoleHeading).toBeVisible({ timeout: 60_000 });
  }
}

test.describe("jwt issuer on project create (#606)", () => {
  test("Create project succeeds with configured IAM base URL (H1 smoke)", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    await dismissSessionLockIfPresent(page);

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
