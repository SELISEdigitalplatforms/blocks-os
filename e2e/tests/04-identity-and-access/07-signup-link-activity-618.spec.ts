import { expect } from "@playwright/test";
import { test } from "../../support/test-base";
import {
  expectChooseOrNoneState,
  expectNoGenerateControl,
  expectNoLinkCredentialLeak,
  navigateToSignupLinkActivityFlow,
  selectFirstConfigurationIfPresent,
} from "../../pages/identity-and-access/signup-link-activity";

/**
 * Feature E2E for blocks-os#618 — Signup Link Activity.
 * Requires blocks-iam SUMMARY endpoint (SPEC25) on the preview environment.
 */
test.describe("flows", () => {
  test("Signup Link Activity: nav, choose state, containment, optional summary", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const summaryHits: string[] = [];
    const bannedHits: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/signup-links/summary")) summaryHits.push(url);
      if (
        (url.includes("/signup-links/query") ||
          /\/signup-links\/?(\?|$)/.test(url) ||
          url.includes("/revoke")) &&
        !url.includes("/signup-links/configurations") &&
        !url.includes("/signup-links/summary")
      ) {
        bannedHits.push(url);
      }
    });

    await test.step("Navigate to Signup Link Activity (H1)", async () => {
      await navigateToSignupLinkActivityFlow(page);
    });

    await test.step("Choose/none state with Refresh only; no Generate (H2, C1)", async () => {
      await expect(page.getByTestId("activity-refresh").or(page.getByRole("button", { name: /Refresh/i }))).toBeVisible({
        timeout: 15_000,
      });
      await expectChooseOrNoneState(page);
      await expectNoGenerateControl(page);
      await expectNoLinkCredentialLeak(page);
      expect(summaryHits.length, "summary must not fire before a configuration is selected").toBe(0);
    });

    await test.step("Select a configuration when available (H3)", async () => {
      const selected = await selectFirstConfigurationIfPresent(page);
      if (!selected) {
        test.info().annotations.push({
          type: "note",
          description: "No configurations in tenant — none/choose path only",
        });
        return;
      }
      await expect
        .poll(() => summaryHits.length, { timeout: 20_000 })
        .toBeGreaterThan(0);
      await expectNoLinkCredentialLeak(page);
      const tiles = page.getByTestId("activity-tiles");
      const empty = page.getByTestId("activity-empty");
      const unknown = page.getByTestId("activity-unknown");
      const error = page.getByTestId("activity-error");
      const forbidden = page.getByTestId("activity-forbidden");
      await expect(tiles.or(empty).or(unknown).or(error).or(forbidden)).toBeVisible({
        timeout: 30_000,
      });
    });

    expect(bannedHits, `banned signup-link calls: ${bannedHits.join(", ")}`).toEqual([]);
  });
});
