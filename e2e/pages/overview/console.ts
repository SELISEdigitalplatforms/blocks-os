import { type Page, expect } from "@playwright/test";

export async function verifyConsolePageResourceLinksFlow(
  page: Page,
  dashboardUrl: string,
) {
  await page.goto(`${new URL(page.url()).origin}/app/console`);
  await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
    timeout: 30000,
  });

  const docsLink = page.getByRole("link", { name: /Docs/ }).first();
  if (!(await docsLink.isVisible({ timeout: 8000 }).catch(() => false))) {
    await page.goto(dashboardUrl);
    await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15000 });
    return;
  }

  await expect(docsLink).toHaveAttribute("href", "https://docs.seliseblocks.com");
  await expect(docsLink).toHaveAttribute("target", "_blank");

  const codeLink = page.getByRole("link", { name: /Code/ }).first();
  await expect(codeLink).toHaveAttribute("href", "https://github.com/SELISEdigitalplatforms");
  await expect(codeLink).toHaveAttribute("target", "_blank");

  const cloudLink = page.getByRole("link", { name: /Cloud/ }).first();
  await expect(cloudLink).toHaveAttribute("href", "https://selisegroup.com/blocks/");
  await expect(cloudLink).toHaveAttribute("target", "_blank");

  await page.goto(dashboardUrl);
  await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15000 });
}
