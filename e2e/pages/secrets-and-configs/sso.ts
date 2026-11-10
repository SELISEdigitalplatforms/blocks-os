import { expect, type Page } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

/**
 * SSO page (`/secret-management/sso`): a card grid of the social auth providers
 * from SOCIAL_AUTH_PROVIDERS_CONFIG — Google and Microsoft are available,
 * "Bring your own SSO" ships disabled ("Coming soon"). No sidebar entry; the
 * route is reached by URL like the rest of the Secrets & Configs pages.
 */

/** A provider's card, scoped from its heading up to the surrounding card container. */
export function providerCard(page: Page, name: string) {
  return page
    .getByRole("heading", { name, exact: true })
    .locator("xpath=ancestor::div[contains(@class,'bg-card')][1]");
}

export async function navigateToSsoFlow(page: Page) {
  await openSecretManagement(page, "sso", "SSO");
}

export async function verifyProviderCardsFlow(page: Page) {
  await expect(providerCard(page, "Google")).toBeVisible();
  await expect(providerCard(page, "Microsoft")).toBeVisible();
  await expect(providerCard(page, "Bring your own SSO")).toBeVisible();

  await expect(
    page.getByText("Allow your users to seamlessly log in with their trusted Google Account."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Enable your users to securely sign in through their trusted Microsoft Account.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Bring your own SSO provider", { exact: true })).toBeVisible();
}

export async function verifySocialConnectionsSubtitleFlow(page: Page) {
  // Every card carries the same "Social Connections" subtitle (3 cards on a fresh tenant).
  await expect(page.getByText("Social Connections")).toHaveCount(3);
}

export async function verifyComingSoonBadgeFlow(page: Page) {
  // Only the disabled "Bring your own SSO" card is marked "Coming soon".
  await expect(providerCard(page, "Bring your own SSO").getByText("Coming soon")).toBeVisible();
  await expect(providerCard(page, "Google").getByText("Coming soon")).toBeHidden();
  await expect(providerCard(page, "Microsoft").getByText("Coming soon")).toBeHidden();
}

export async function verifyAvailableProviderConfigureMenuFlow(page: Page, name: string) {
  const card = providerCard(page, name);
  await card.getByRole("button").click();
  // Radix portals the dropdown to <body>, so scope the menu from the page, not the card.
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Configure" })).toBeVisible();

  // Fresh tenant: the provider is not configured yet, so only Configure is offered —
  // Enable/Disable requires an existing itemId.
  await expect(menu.getByRole("menuitem", { name: /^Enable$/i })).toBeHidden();
  await expect(menu.getByRole("menuitem", { name: /^Disable$/i })).toBeHidden();

  // The Configure entry is wired to the sso-configuration route (regression guard
  // on the link wiring itself — navigating there is out of scope: the IAM route
  // table currently has no sso-configuration child, so the click dead-ends).
  await expect(
    menu.getByRole("menuitem", { name: "Configure" }).locator("xpath=ancestor::a[1]"),
  ).toHaveAttribute("href", /sso-configuration/);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
}

export async function verifyUnavailableProviderHasNoMenuFlow(page: Page) {
  const card = providerCard(page, "Bring your own SSO");
  await expect(card).toBeVisible();
  // "Bring your own SSO" is unavailable — no dropdown trigger is rendered at all.
  await expect(card.getByRole("button")).toHaveCount(0);
}
