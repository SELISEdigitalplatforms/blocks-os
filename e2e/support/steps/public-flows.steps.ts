import { expect, type Page } from "@playwright/test";

export async function openInvitationWithoutCode(page: Page): Promise<void> {
  await page.goto("/invitation");
  await page.waitForURL(/\/invitation(\/|$)/, { timeout: 30_000 });
}

export async function expectInvalidInvitationVisible(page: Page): Promise<void> {
  await expect(page.getByText("Invalid invitation link")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("missing a confirmation code")).toBeVisible({
    timeout: 30_000,
  });
}

export async function openActivationWithoutCode(page: Page): Promise<void> {
  await page.goto("/activate");
  await page.waitForURL(/\/activate(\/|$)/, { timeout: 30_000 });
}

export async function expectInvalidActivationVisible(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Invalid Activation Link" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("link", { name: "Go to sign in" })).toBeVisible({
    timeout: 30_000,
  });
}
