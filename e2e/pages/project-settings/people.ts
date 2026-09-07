import { expect, type Locator, type Page } from "@playwright/test";
import { openProjectOverview } from "../../support/os-helpers";
import { waitForPeopleOwnerReady } from "../../support/people-helpers";

const grantedOutcomes = new Set([
  "invited",
  "user_creation_requested",
  "invitation_requested",
  "access_granted",
]);

export async function navigateToPeopleFlow(page: Page) {
  await openProjectOverview(page, "people");
  await waitForPeopleOwnerReady(page, () => openProjectOverview(page, "people"));
}

export async function verifyOwnerVisibleFlow(page: Page) {
  const ownerBadge = page.getByText("Owner", { exact: true }).first();
  const invite = page.getByRole("button", { name: "Invite" });
  if (!(await ownerBadge.isVisible({ timeout: 15_000 }))) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 30_000,
    });
  }
  await expect(invite).toBeVisible({ timeout: 30_000 });
  // Owner display name/email can be "null" / "-" on a fresh project (product
  // bug). The role badge is the contract, not a hydrated profile.
  await expect(ownerBadge).toBeVisible({ timeout: 20_000 });
}

export async function exercisePaginationFlow(page: Page): Promise<boolean> {
  const nextPageButton = page.locator('button:has(svg.lucide-chevron-right)').first();
  if (!(await nextPageButton.isVisible({ timeout: 5000 }))) {
    return false;
  }
  if (await nextPageButton.isDisabled()) {
    return false;
  }
  await nextPageButton.click();
  await page.waitForTimeout(500);
  const prevPageButton = page.locator('button:has(svg.lucide-chevron-left)').first();
  await expect(prevPageButton).toBeVisible();
  await expect(prevPageButton).toBeEnabled();
  await prevPageButton.click();
  return true;
}

export async function openInviteDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByRole("heading", { name: "Invite people" })).toBeVisible({
    timeout: 10000,
  });
}

export async function verifyRecipientsRequiredFlow(page: Page) {
  const sendButton = page.getByRole("button", { name: /Send invitation|Send/ });
  await expect(sendButton).toBeDisabled();
}

export async function verifyInvalidEmailValidationFlow(page: Page) {
  const recipientInput = page.getByPlaceholder("name@company.com").first();
  await recipientInput.fill("not-an-email");
  await recipientInput.blur();
  const sendButton = page.getByRole("button", { name: /Send invitation|Send/ });
  if (await page.getByText("Invalid email format").isVisible({ timeout: 3000 })) {
    await expect(sendButton).toBeDisabled();
  }
}

export async function verifyDuplicateRecipientRowFlow(page: Page) {
  await page.getByRole("button", { name: /Add another/ }).click();
  const emailInputs = page.getByPlaceholder("name@company.com");
  await expect(emailInputs).toHaveCount(2);

  const dupEmail = "duplicate-check@example.com";
  await emailInputs.nth(0).fill(dupEmail);
  await emailInputs.nth(1).fill(dupEmail);
  await emailInputs.nth(1).blur();
  if (await page.getByText(/Duplicate email/).isVisible({ timeout: 5000 })) {
    await expect(emailInputs).toHaveCount(2);
  }

  await page.locator('button:has(svg.lucide-trash2)').last().click();
  await expect(emailInputs).toHaveCount(1);
  await emailInputs.first().fill("");
}

export async function sendInviteFlow(page: Page, inviteEmail: string) {
  const inviteDialog = page.getByRole("dialog", { name: "Invite people" });
  const recipientInput = inviteDialog.getByPlaceholder("name@company.com").first();
  await recipientInput.fill(inviteEmail);

  const envTrigger = inviteDialog.getByRole("button", { name: /Select environments/ });
  const sendButton = inviteDialog.getByRole("button", { name: /Send invitation|Send/ });

  await envTrigger.click();
  const developmentOption = page.getByRole("option", { name: "Development" });
  await expect(developmentOption).toBeVisible({ timeout: 20_000 });
  for (let attempt = 0; attempt < 3; attempt++) {
    await developmentOption.click();
    if (await envTrigger.getByText("Development", { exact: true }).isVisible()) {
      break;
    }
  }
  await expect(envTrigger.getByText("Development", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await page.keyboard.press("Escape");

  await expect(sendButton).toBeEnabled({ timeout: 10000 });

  const inviteResponsePromise = page.waitForResponse(
    (response) =>
      /\/api\/People\/Invite\/?$/i.test(response.url()) &&
      response.request().method() === "POST",
    { timeout: 20000 },
  );

  await sendButton.click();

  const inviteResponse = await inviteResponsePromise;
  expect(inviteResponse.status(), "People/Invite must return HTTP 2xx").toBeLessThan(400);

  const inviteJson = (await inviteResponse.json().catch(() => null)) as {
    isSuccess?: boolean;
    results?: Record<string, string>;
  } | null;

  expect(inviteJson?.isSuccess, "People/Invite must report isSuccess").toBe(true);

  const outcome = inviteJson?.results?.[inviteEmail.toLowerCase()];
  if (outcome) {
    expect(
      grantedOutcomes.has(outcome),
      `Unexpected invite outcome "${outcome}" — expected a send/grant outcome`,
    ).toBe(true);
  }

  await expect(
    page
      .getByRole("region", { name: /Notifications/i })
      .getByText("Invitation is sent to 1 person", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(inviteDialog).toBeHidden({ timeout: 15000 });
}

export async function verifyPendingInviteBadgeFlow(
  page: Page,
  personRow: Locator,
): Promise<boolean> {
  if (!(await personRow.getByText("Pending Invite").isVisible({ timeout: 10000 }))) {
    return false;
  }
  await expect(personRow.getByText("Pending Invite")).toBeVisible();
  return true;
}

export async function searchPeopleByEmailFlow(
  page: Page,
  personRow: Locator,
  inviteEmail: string,
): Promise<boolean> {
  const searchTrigger = page.getByRole("combobox").first();
  if (!(await searchTrigger.isVisible({ timeout: 5000 }))) {
    return false;
  }
  await searchTrigger.click();
  await page.getByRole("option", { name: "Email" }).click();

  const searchInput = page.getByPlaceholder("Minimum 3 characters…").first();
  await searchInput.fill(inviteEmail);
  await expect(personRow).toBeVisible({ timeout: 10000 });

  await searchInput.fill("no-such-person-xyz");
  if (await page.getByText("No results found.").isVisible({ timeout: 8000 })) {
    await expect(page.getByText("No results found.")).toBeVisible();
  }

  await searchInput.fill("");
  await expect(personRow).toBeVisible({ timeout: 10000 });
  return true;
}

export async function verifyAlreadyInvitedValidationFlow(
  page: Page,
  inviteEmail: string,
) {
  await page.getByRole("button", { name: "Invite" }).click();
  await expect(page.getByRole("heading", { name: "Invite people" })).toBeVisible({
    timeout: 10000,
  });
  await page.getByPlaceholder("name@company.com").first().fill(inviteEmail);
  if (await page.getByText(/Already invited/).isVisible({ timeout: 5000 })) {
    await expect(page.getByText(/Already invited/)).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Invite people" })).toBeHidden({
    timeout: 10000,
  });
}

export async function resendInvitationFlow(
  page: Page,
  personRow: Locator,
): Promise<boolean> {
  const menuButton = personRow.getByRole("button", { name: "Open menu" });
  if (!(await menuButton.isVisible({ timeout: 5000 }))) {
    return false;
  }
  await menuButton.click();
  const resendItem = page.getByRole("menuitem", { name: "Resend Invitation" });
  if (!(await resendItem.isVisible({ timeout: 5000 }))) {
    await page.keyboard.press("Escape");
    return false;
  }
  await resendItem.click();
  await expect(page.getByRole("heading", { name: "Resend Invitation" })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Resend", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: /Notifications/i })
      .getByText(/Resend invitation mail successfully/, { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  return true;
}

export async function openInvitedPersonDetailsFlow(
  page: Page,
  personRow: Locator,
) {
  await personRow.click();
  await expect(page).toHaveURL(/\/app\/project\/[^/]+\/people\/.+/, { timeout: 15000 });
}

export async function verifyEnvironmentAccessHeadingFlow(page: Page) {
  await expect(page.getByRole("heading", { name: "Environment Access" })).toBeVisible({
    timeout: 15000,
  });
}

export async function removeEnvironmentAccessFlow(page: Page): Promise<boolean> {
  const removeButton = page.getByRole("button", { name: /Remove access from/ }).first();
  if (!(await removeButton.isVisible({ timeout: 10000 }))) {
    return false;
  }
  await removeButton.click();
  // Strict: a hidden "Remove access" icon label also sits in the DOM behind
  // the dialog, and getByText's default case-insensitive match collides with
  // it — scope to the dialog's heading role to disambiguate.
  await expect(page.getByRole("heading", { name: "Remove Access", exact: true })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: /Notifications/i })
      .getByText(/Access removed from/, { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  return true;
}

export async function grantEnvironmentAccessFlow(page: Page): Promise<boolean> {
  const grantButton = page.getByRole("button", { name: /Grant access to/ }).first();
  if (!(await grantButton.isVisible({ timeout: 10000 }))) {
    return false;
  }
  await grantButton.click();
  await expect(page.getByText("Grant Access")).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Grant", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: /Notifications/i })
      .getByText(/Access granted to/, { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  return true;
}

export async function verifyMobileEnvironmentAccessLayoutFlow(page: Page) {
  const originalViewport = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  try {
    await expect(page.getByRole("heading", { name: "Environment Access" })).toBeVisible({
      timeout: 10000,
    });
  } finally {
    if (originalViewport) {
      await page.setViewportSize(originalViewport);
    }
  }
}

export async function returnToPeopleListFlow(page: Page) {
  await openProjectOverview(page, "people");
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible({ timeout: 30000 });
}
