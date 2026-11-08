import { expect, type Locator, type Page, type Request } from "@playwright/test";
import { test } from "../../support/test-base";
import { openManageTemplateFlow } from "../../pages/secrets-and-configs/oidc";

/**
 * OIDC branding editor — "Show animation panel" switch (Phase 2 of 2).
 *
 * Verifies the switch on the Branding tab makes no request when toggled, is covered by
 * Undo, saves with the header Save in a single PUT /oidc-template carrying
 * `layout.showAnimationPanel`, and reads back the saved value after a reload (the
 * round-trip through blocks-iam; requires Phase 1 deployed). The original value is
 * restored at the end so the suite leaves the tenant's template as it found it.
 */

const isTemplateRequest = (req: Request) => /\/oidc-template\/?$/.test(new URL(req.url()).pathname);
const isTemplateSave = (req: Request) => req.method() === "PUT" && isTemplateRequest(req);

const panelSwitch = (page: Page): Locator =>
  page.getByRole("switch", { name: "Show animation panel" });

async function saveTemplateFlow(page: Page, saveButton: Locator) {
  const saved = page.waitForRequest(isTemplateSave, { timeout: 20_000 });
  await saveButton.click();
  const body = (await saved).postDataJSON() as { layout?: { showAnimationPanel?: unknown } };
  await expect(page.getByText("Template saved successfully", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(saveButton).toBeDisabled();
  return body;
}

test.describe("OIDC branding: show animation panel switch", () => {
  test("toggle -> undo -> save -> reload round-trip -> restore", async ({ page }) => {
    test.setTimeout(180_000);

    const branding = await openManageTemplateFlow(page);
    const layoutTab = branding.templateSections.getByRole("tab", { name: "Layout" });
    await layoutTab.click();
    await expect(layoutTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: "Layout" })).toBeVisible();
    const toggle = panelSwitch(page);
    await expect(toggle).toBeVisible();
    const initial = (await toggle.getAttribute("aria-checked")) === "true";
    const flipped = String(!initial);

    await test.step("H3/H9: toggling marks the form dirty and makes no request", async () => {
      const requests: Request[] = [];
      const onRequest = (req: Request) => {
        if (isTemplateRequest(req)) requests.push(req);
      };
      page.on("request", onRequest);
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", flipped);
      await expect(branding.brandingSaveButton).toBeEnabled();
      await expect(branding.brandingUndoButton).toBeEnabled();
      await page.waitForTimeout(1_000);
      page.off("request", onRequest);
      expect(requests, "toggling must not call /oidc-template").toHaveLength(0);
    });

    await test.step("H5: Undo restores the saved value", async () => {
      await branding.brandingUndoButton.click();
      await expect(toggle).toHaveAttribute("aria-checked", String(initial));
      await expect(branding.brandingSaveButton).toBeDisabled();
    });

    await test.step("H8: Space toggles the focused switch", async () => {
      await toggle.focus();
      await page.keyboard.press("Space");
      await expect(toggle).toHaveAttribute("aria-checked", flipped);
    });

    await test.step("H4: Save sends the switch state in one PUT", async () => {
      const body = await saveTemplateFlow(page, branding.brandingSaveButton);
      expect(body.layout?.showAnimationPanel).toBe(!initial);
    });

    await test.step("H11: the saved value survives a reload", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      // The editor keeps the open section in the URL, so the reload lands back on Layout.
      await expect(page.getByRole("heading", { name: "Layout" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(panelSwitch(page)).toHaveAttribute("aria-checked", flipped, {
        timeout: 15_000,
      });
    });

    await test.step("Restore the original value", async () => {
      await panelSwitch(page).click();
      await expect(panelSwitch(page)).toHaveAttribute("aria-checked", String(initial));
      const body = await saveTemplateFlow(page, branding.brandingSaveButton);
      expect(body.layout?.showAnimationPanel).toBe(initial);
    });
  });
});
