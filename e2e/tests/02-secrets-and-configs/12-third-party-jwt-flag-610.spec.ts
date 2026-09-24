import { expect, type Page, type Request } from "@playwright/test";
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
import { e2eBaseUrl } from "../../support/env";

/**
 * #610 Phase 1 — provider-derived deactivation + guarded enable for
 * Tenant.IsThirdPartyJwtEnabled (backend). UI toggle is Phase 2 (#611).
 *
 * Live preview APIs with the authenticated browser session:
 * create an active provider → enable flag → Project/Get shows true →
 * delete last provider → flag drops to false → enable with zero actives
 * returns no_active_provider.
 */

type ApiHeaders = Record<string, string>;

function pickApiHeaders(req: Request): ApiHeaders | null {
  if (!/\/api\/Project\//i.test(req.url())) return null;
  const h = req.headers();
  const out: ApiHeaders = { "content-type": "application/json" };
  for (const key of ["authorization", "x-blocks-key", "cookie", "x-requested-with"]) {
    if (h[key]) out[key] = h[key];
  }
  if (!out.authorization && !out["x-blocks-key"] && !out.cookie) return null;
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

type ProjectGetBody = {
  isThirdPartyJwtEnabled?: boolean;
  IsThirdPartyJwtEnabled?: boolean;
  data?: Record<string, unknown>;
};

async function projectGet(page: Page, headers: ApiHeaders): Promise<ProjectGetBody> {
  const res = await page.request.get(`${e2eBaseUrl()}/api/Project/Get`, { headers });
  expect(res.ok(), `Project/Get HTTP ${res.status()}`).toBeTruthy();
  return res.json();
}

function readFlag(body: ProjectGetBody): boolean {
  if (typeof body.isThirdPartyJwtEnabled === "boolean") return body.isThirdPartyJwtEnabled;
  if (typeof body.IsThirdPartyJwtEnabled === "boolean") return body.IsThirdPartyJwtEnabled;
  const data = body.data ?? {};
  const camel = data.isThirdPartyJwtEnabled;
  const pascal = data.IsThirdPartyJwtEnabled;
  if (typeof camel === "boolean") return camel;
  if (typeof pascal === "boolean") return pascal;
  throw new Error(
    `Project/Get missing isThirdPartyJwtEnabled: ${JSON.stringify(body).slice(0, 400)}`,
  );
}

type UpdateBody = {
  isSuccess?: boolean;
  IsSuccess?: boolean;
  errors?: Record<string, string>;
  Errors?: Record<string, string>;
};

async function updateFlag(
  page: Page,
  headers: ApiHeaders,
  isEnabled: boolean,
): Promise<UpdateBody> {
  const res = await page.request.post(`${e2eBaseUrl()}/api/Project/UpdateThirdPartyJwtEnabled`, {
    headers,
    data: { isEnabled },
  });
  expect(
    res.ok() || res.status() === 400,
    `UpdateThirdPartyJwtEnabled HTTP ${res.status()}`,
  ).toBeTruthy();
  return res.json();
}

type ProviderRow = {
  itemId?: string;
  ItemId?: string;
  key?: string;
  Key?: string;
  isActive?: boolean;
  IsActive?: boolean;
};

async function listProviders(page: Page, headers: ApiHeaders): Promise<ProviderRow[]> {
  const res = await page.request.get(`${e2eBaseUrl()}/api/Project/GetThirdPartyJwtProviders`, {
    headers,
  });
  expect(res.ok(), `GetThirdPartyJwtProviders HTTP ${res.status()}`).toBeTruthy();
  const body = await res.json();
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

function providerItemId(row: ProviderRow): string | undefined {
  return row.itemId || row.ItemId;
}

async function deleteProviderById(
  page: Page,
  headers: ApiHeaders,
  itemId: string,
): Promise<void> {
  const res = await page.request.post(`${e2eBaseUrl()}/api/Project/DeleteThirdPartyJwtProvider`, {
    headers,
    data: { itemId },
  });
  expect(res.ok(), `DeleteThirdPartyJwtProvider HTTP ${res.status()}`).toBeTruthy();
}

test.describe("third-party JWT flag derivation (#610)", () => {
  test("enable requires active provider; last delete lowers the flag", async ({ page }) => {
    test.setTimeout(300_000);

    const headers = await captureProjectApiHeaders(page);

    await test.step("Clear any leftover providers so the suite owns the active set", async () => {
      const existing = await listProviders(page, headers);
      for (const row of existing) {
        const id = providerItemId(row);
        if (id) await deleteProviderById(page, headers, id);
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await navigateToExternalIdpFlow(page);
      await verifyEmptyStateFlow(page);
    });

    const suffix = Date.now();
    const provider = {
      key: `flag610-${suffix}`,
      issuer: `https://example.com/issuer-610-${suffix}`,
      audience: `https://example.com/api-610-${suffix}`,
    };

    await test.step("Create an active external IdP provider", async () => {
      await openAddProviderDialogFlow(page);
      await fillProviderFormFlow(page, provider);
      await saveNewProviderFlow(page);
      await verifyProviderCardFlow(page, provider);
    });

    await test.step("Project/Get exposes isThirdPartyJwtEnabled", async () => {
      const body = await projectGet(page, headers);
      expect(() => readFlag(body)).not.toThrow();
    });

    await test.step("Enable succeeds with ≥1 active provider", async () => {
      const body = await updateFlag(page, headers, true);
      const success = body.isSuccess ?? body.IsSuccess;
      const errors = body.errors ?? body.Errors ?? {};
      expect(success, `enable should succeed; errors=${JSON.stringify(errors)}`).toBe(true);
      expect(readFlag(await projectGet(page, headers))).toBe(true);
    });

    await test.step("Deleting the last active provider lowers the flag", async () => {
      await deleteProviderFlow(page, provider.key);
      await page.waitForTimeout(1500);
      expect(readFlag(await projectGet(page, headers))).toBe(false);
    });

    await test.step("Enable with zero active providers returns no_active_provider", async () => {
      const body = await updateFlag(page, headers, true);
      const success = body.isSuccess ?? body.IsSuccess;
      const errors = body.errors ?? body.Errors ?? {};
      expect(success).toBe(false);
      expect(errors).toHaveProperty("no_active_provider");
      expect(readFlag(await projectGet(page, headers))).toBe(false);
    });
  });
});
