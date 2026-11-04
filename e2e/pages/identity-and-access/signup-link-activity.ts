import { expect, type Page } from "@playwright/test";
import { openIam } from "../../support/os-helpers";

export async function navigateToSignupLinkActivityFlow(page: Page) {
  await openIam(page, "signup-link-activity", "Signup Link Activity");
  await expect(page.getByRole("heading", { name: "Signup Link Activity", exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

export async function expectChooseOrNoneState(page: Page) {
  const choose = page.getByTestId("activity-choose");
  const none = page.getByTestId("activity-none");
  const forbidden = page.getByTestId("activity-forbidden");
  await expect(choose.or(none).or(forbidden)).toBeVisible({ timeout: 30_000 });
}

export async function expectNoGenerateControl(page: Page) {
  await expect(page.getByRole("button", { name: /Generate/i })).toHaveCount(0);
}

export async function expectNoLinkCredentialLeak(page: Page) {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/#link=/i);
  expect(body).not.toMatch(/https?:\/\/[^\s]+\/signup-links\/[^\s]+/i);
}

export async function selectFirstConfigurationIfPresent(page: Page) {
  const select = page.getByTestId("activity-configuration-select");
  if (!(await select.isVisible().catch(() => false))) {
    return false;
  }
  await select.click();
  const option = page.getByRole("option").first();
  if (!(await option.isVisible().catch(() => false))) {
    return false;
  }
  await option.click();
  await expect(page).toHaveURL(/configurationId=/);
  return true;
}

export async function expectSummaryRequestOnly(page: Page) {
  const summaryPosts: string[] = [];
  const banned: string[] = [];
  page.on("request", (req) => {
    if (req.method() !== "POST" && req.method() !== "GET") return;
    const url = req.url();
    if (url.includes("/signup-links/summary")) summaryPosts.push(url);
    if (
      /\/signup-links\/?(?:\?|$)/.test(url) ||
      url.includes("/signup-links/query") ||
      url.includes("/revoke")
    ) {
      if (!url.includes("/signup-links/configurations") && !url.includes("/signup-links/summary")) {
        banned.push(url);
      }
    }
  });
  return {
    assertClean: () => {
      expect(banned, `unexpected signup-link calls: ${banned.join(", ")}`).toEqual([]);
    },
    summaryPosts,
  };
}
