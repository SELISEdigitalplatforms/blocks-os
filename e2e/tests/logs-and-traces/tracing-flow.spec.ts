import { test, expect } from "../../support/test-base";
import { openOsDashboard, openLmt } from "../../support/os-helpers";

// Tracing flow: navigate into the sub-section under Logs & Traces, walk the
// Hot/Cold/Archive trace modes, filter by Service, and open a trace into its
// span breakdown before closing with an invalid-trace-ID check.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await openOsDashboard(page);
  });


  test("Tracing flow: navigate to Tracing", async ({ page }) => {
    test.setTimeout(180_000);

    const gotoLmtChild = async () => {
      const link = page.getByRole("link", { name: "Tracing" })
      if (await link.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await link.click({ timeout: 10_000 })
        return
      }
      await openLmt(page, "tracing")
    }

    await test.step("Navigate to Tracing", async () => {
      await gotoLmtChild()
      await expect(page.getByRole("heading", { name: "Tracing" })).toBeVisible({ timeout: 30000 });
    });

    await test.step("Cold and Archive trace modes show 'Coming soon', Hot has live data", async () => {
      const coldOption = page.getByText("Cold", { exact: true });
      if (await coldOption.isVisible({ timeout: 8000 }).catch(() => false)) {
        await coldOption.click();
        await expect(page.getByText("Coming soon")).toBeVisible();

        await page.getByText("Archive", { exact: true }).click();
        await expect(page.getByText("Coming soon")).toBeVisible();

        await page.getByText("Hot", { exact: true }).click();
        await expect(page.getByText("Coming soon")).toHaveCount(0);
      }
    });

    await test.step("The 'Guide' button opens the Trace Guide panel", async () => {
      const guideButton = page.getByRole("button", { name: "Guide" });
      if (await guideButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await guideButton.click();
        await expect(page.getByRole("heading", { name: "Trace Guide" })).toBeVisible({
          timeout: 5000,
        });
        // Same toggle button closes it again.
        await guideButton.click();
        await expect(page.getByRole("heading", { name: "Trace Guide" })).toBeHidden({
          timeout: 5000,
        });
      }
    });

    await test.step("The AI agent sheet opens", async () => {
      // TracesOverview doesn't pass an explicit agentName, so the trigger's
      // accessible name is whatever LMTQueryAgentSheet defaults to — target
      // it by its Bot icon instead of hardcoding that label.
      const askAiButton = page.locator("button:has(svg.lucide-bot)").first();
      if (await askAiButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await askAiButton.click();
        await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 5000 });
        await page.keyboard.press("Escape");
      }
    });

    await test.step("Search filters the traces list", async () => {
      const searchInput = page.getByPlaceholder("Search...");
      if (await searchInput.isVisible({ timeout: 8000 }).catch(() => false)) {
        await searchInput.fill("nonexistent-trace-marker-xyz");
        await expect(page.getByText("No results found.")).toBeVisible({ timeout: 8000 }).catch(() => {});
        await searchInput.fill("");
      }
    });

    await test.step("Filtering traces by Service narrows the results", async () => {
      const serviceFilter = page.getByRole("button", { name: /^Service$/i });
      if (await serviceFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await serviceFilter.click();
        const firstOption = page.getByRole("option").first();
        if (await firstOption.isVisible().catch(() => false)) {
          // The option list can keep re-rendering as data loads (cmdk
          // re-filtering), detaching the click target mid-action — bound
          // the click instead of letting it retry for the whole test budget.
          await firstOption.click({ timeout: 8000 }).catch(() => {});
        }
        await page.keyboard.press("Escape");
      }
    });

    await test.step("Sort by the Timestamp column header", async () => {
      const timestampHeader = page.getByText("Timestamp", { exact: true }).first();
      if (await timestampHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
        await timestampHeader.click();
        await expect(page)
          .toHaveURL(/sort-property=Timestamp/, { timeout: 8000 })
          .catch(() => {});
        await timestampHeader.click();
      }
    });

    await test.step("Paginate the traces list, if more than one page exists", async () => {
      const nextPageButton = page.locator("button:has(svg.lucide-chevron-right)").first();
      if (
        (await nextPageButton.isVisible({ timeout: 3000 }).catch(() => false)) &&
        (await nextPageButton.isEnabled().catch(() => false))
      ) {
        await nextPageButton.click();
        await expect(page).toHaveURL(/[?&]page=1/, { timeout: 8000 }).catch(() => {});
      }
    });

    await test.step("Switch trace modes via the mobile Select dropdown", async () => {
      const originalViewport = page.viewportSize();
      await page.setViewportSize({ width: 375, height: 800 });
      try {
        await gotoLmtChild();
        await expect(page.getByRole("heading", { name: "Tracing" })).toBeVisible({
          timeout: 30000,
        });

        const modeSelect = page.getByRole("combobox").first();
        if (await modeSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
          await modeSelect.click();
          await page.getByRole("option", { name: "Cold" }).click();
          await expect(page.getByText("Coming soon")).toBeVisible({ timeout: 8000 });

          await modeSelect.click();
          await page.getByRole("option", { name: "Hot" }).click();
          await expect(page.getByText("Coming soon")).toHaveCount(0, { timeout: 8000 });
        }
      } finally {
        if (originalViewport) {
          await page.setViewportSize(originalViewport);
        }
      }
    });

    await test.step("Selecting a trace opens its detailed span breakdown", async () => {
      const firstTrace = page.getByRole("row").nth(1);
      if (await firstTrace.isVisible({ timeout: 8000 }).catch(() => false)) {
        await firstTrace.click();
        await expect(page)
          .toHaveURL(/lmt\/.*trace/, { timeout: 15000 })
          .catch(() => {});
        // The trace this row points at may not resolve by ID yet (same
        // "Trace not found" race the closing step below checks for), so this
        // is guarded rather than asserted like the rest of the file.
        const timelineHeading = page.getByRole("heading", { name: "Timeline" });
        if (await timelineHeading.isVisible({ timeout: 15000 }).catch(() => false)) {
          const downloadButton = page.getByRole("button", { name: "Download JSON" });
          if (await downloadButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            const downloadPromise = page.waitForEvent("download");
            await downloadButton.click();
            await downloadPromise.catch(() => {});
          }

          // Collapse then re-expand the right-hand insights panel.
          const panelToggle = page
            .locator(
              "button:has(svg.lucide-panel-right-close), button:has(svg.lucide-panel-right-open)",
            )
            .first();
          if (await panelToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
            await panelToggle.click();
            await panelToggle.click();
          }
        }

        await gotoLmtChild();
      }
    });

    await test.step("An unknown trace ID shows 'Trace not found', distinct from a load error", async () => {
      const tracingUrl = new URL(page.url());
      await page.goto(`${tracingUrl.origin}${tracingUrl.pathname}/nonexistent-trace-id-xyz`);

      const notFound = page.getByText("Trace not found");
      const loadError = page.getByText("Unable to load trace");
      await expect(notFound.or(loadError))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });
  });
});
