import { test } from "../../support/test-base";
import {
  navigateToSsoFlow,
  providerCard,
  verifyAvailableProviderConfigureMenuFlow,
  verifyComingSoonBadgeFlow,
  verifyProviderCardsFlow,
  verifySocialConnectionsSubtitleFlow,
  verifyUnavailableProviderHasNoMenuFlow,
} from "../../pages/secrets-and-configs/sso";

// SSO flow: the provider card grid only — Google and Microsoft are available
// (Configure menu) while "Bring your own SSO" ships disabled ("Coming soon",
// no menu). No OAuth credentials are entered: configuring a real provider
// needs external console setup, so this spec guards the page structure and
// the menu wiring.
test.describe("flows", () => {
  test("SSO flow: provider cards -> Coming soon badge -> Configure menu -> unavailable provider has no menu", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await test.step("Navigate to SSO", async () => {
      await navigateToSsoFlow(page);
    });

    await test.step("All provider cards render with their descriptions", async () => {
      await verifyProviderCardsFlow(page);
    });

    await test.step("Every card carries the Social Connections subtitle", async () => {
      await verifySocialConnectionsSubtitleFlow(page);
    });

    await test.step("'Coming soon' badge appears only on Bring your own SSO", async () => {
      await verifyComingSoonBadgeFlow(page);
    });

    await test.step("Google card: Configure menu without Enable/Disable (not configured yet)", async () => {
      await verifyAvailableProviderConfigureMenuFlow(page, "Google");
    });

    await test.step("Microsoft card: Configure menu without Enable/Disable (not configured yet)", async () => {
      await verifyAvailableProviderConfigureMenuFlow(page, "Microsoft");
    });

    await test.step("Regression guard: unavailable provider renders no menu trigger", async () => {
      await verifyUnavailableProviderHasNoMenuFlow(page);
    });

    await test.step("Reload keeps the provider grid stable", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await providerCard(page, "Google").waitFor({ state: "visible", timeout: 30_000 });
      await providerCard(page, "Bring your own SSO").waitFor({ state: "visible", timeout: 30_000 });
    });
  });
});
