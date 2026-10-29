import { expect, type Locator, type Page, type Request } from "@playwright/test";
import { test } from "../../support/test-base";
import {
  deleteProviderFlow,
  fillProviderFormFlow,
  navigateToExternalIdpFlow,
  openAddProviderDialogFlow,
  saveNewProviderFlow,
  verifyEmptyStateFlow,
  verifyProviderCardFlow,
} from "../../pages/secrets-and-configs/external-idp";

/**
 * #611 Phase 2 — External IdP trust toggle on the authentication config page.
 *
 * Verifies the switch renders server state, stays disabled with zero active
 * providers, enables/disables with success toasts once a provider exists, and
 * returns to the disabled helper state after the last provider is removed.
 */

type ApiHeaders = Record<string, string>;

function pickApiHeaders(req: Request): ApiHeaders | null {
  if (!/\/api\/Project\//i.test(req.url())) return null;
  const h = req.headers();
  const out: ApiHeaders = { "content-type": "application/json" };
  for (const key of ["authorization", "x-blocks-key", "x-requested-with"]) {
    if (h[key]) out[key] = h[key];
  }
  if (!out.authorization && !out["x-blocks-key"]) return null;
  return out;
}

async function captureProjectApiHeaders(page: Page): Promise<ApiHeaders> {
  let headers: ApiHeaders | null = null;
  const onRequest = (req: Request) => {
    const picked = pickApiHeaders(req);
    if (picked) headers = picked;
  };
  page.on("request", onRequest);
  await navigateToExternalIdpFlow(page);
  await page.waitForTimeout(1500);
  if (!headers) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  }
  page.off("request", onRequest);
  if (!headers) {
    throw new Error("Did not capture Project API headers from the authenticated session");
  }
  return headers;
}

async function pageApi<T>(
  page: Page,
  headers: ApiHeaders,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; json: T }> {
  return page.evaluate(
    async ({ method, path, headers, body }) => {
      const res = await fetch(path, {
        method,
        credentials: "include",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as T;
      return { status: res.status, json };
    },
    { method, path, headers, body },
  );
}

type ProviderRow = {
  itemId?: string;
  ItemId?: string;
};

async function listProviders(page: Page, headers: ApiHeaders): Promise<ProviderRow[]> {
  const { status, json } = await pageApi<ProviderRow[] | { data?: ProviderRow[] }>(
    page,
    headers,
    "GET",
    "/api/Project/GetThirdPartyJwtProviders",
  );
  expect(status, `GetThirdPartyJwtProviders HTTP ${status}`).toBe(200);
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

async function deleteProviderById(
  page: Page,
  headers: ApiHeaders,
  itemId: string,
): Promise<void> {
  const { status } = await pageApi(page, headers, "POST", "/api/Project/DeleteThirdPartyJwtProvider", {
    itemId,
  });
  expect(status, `DeleteThirdPartyJwtProvider HTTP ${status}`).toBeLessThan(300);
}

const trustSwitch = (page: Page): Locator =>
  page.getByRole("switch", { name: "Accept tokens from external identity providers" });

test.describe("external IdP trust toggle (#611)", () => {
  test("empty state disables enable; active provider allows toggle on/off", async ({ page }) => {
    test.setTimeout(300_000);

    const headers = await captureProjectApiHeaders(page);

    await test.step("Clear leftover providers so the suite owns the active set", async () => {
      const existing = await listProviders(page, headers);
      for (const row of existing) {
        const id = row.itemId || row.ItemId;
        if (id) await deleteProviderById(page, headers, id);
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await navigateToExternalIdpFlow(page);
      await verifyEmptyStateFlow(page);
    });

    await test.step("Trust switch visible, unchecked, disabled with helper", async () => {
      await expect(page.getByText("Accept tokens from external identity providers")).toBeVisible({
        timeout: 30_000,
      });
      const sw = trustSwitch(page);
      await expect(sw).toBeVisible({ timeout: 30_000 });
      await expect(sw).not.toBeChecked();
      await expect(sw).toBeDisabled();
      await expect(
        page.getByText("Add an active provider to enable third-party token trust."),
      ).toBeVisible();
    });

    const suffix = Date.now();
    const provider = {
      key: `trust611-${suffix}`,
      issuer: `https://example.com/issuer-611-${suffix}`,
      audience: `https://example.com/api-611-${suffix}`,
    };

    await test.step("Create an active external IdP provider", async () => {
      await openAddProviderDialogFlow(page);
      await fillProviderFormFlow(page, provider);
      await saveNewProviderFlow(page);
      await verifyProviderCardFlow(page, provider);
    });

    await test.step("Enable trust succeeds with ≥1 active provider", async () => {
      const sw = trustSwitch(page);
      await expect(sw).toBeEnabled({ timeout: 15_000 });
      await expect(sw).not.toBeChecked();
      await sw.click();
      await expect(
        page.getByText("External identity provider trust enabled", { exact: true }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(sw).toBeChecked();
    });

    await test.step("Disable trust returns to off", async () => {
      const sw = trustSwitch(page);
      await expect(sw).toBeChecked();
      await sw.click();
      await expect(
        page.getByText("External identity provider trust disabled", { exact: true }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(sw).not.toBeChecked();
    });

    await test.step("Deleting the last provider disables enable again", async () => {
      await deleteProviderFlow(page, provider.key);
      await expect(trustSwitch(page)).toBeVisible();
      await expect(
        page.getByText("Add an active provider to enable third-party token trust."),
      ).toBeVisible({ timeout: 15_000 });
      await expect(trustSwitch(page)).toBeDisabled();
      await expect(trustSwitch(page)).not.toBeChecked();
    });
  });
});
