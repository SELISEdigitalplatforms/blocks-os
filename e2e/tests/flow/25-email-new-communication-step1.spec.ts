import { test, expect } from "../../support/test-base";
import { openEmailManagementPage } from "../../support/steps/email-management.steps";
import { randomToken } from "../../support/flow-state";

// Real mutation-and-verify test, partial depth by design: fills and submits
// step 1 (Basic information) of the New Communication wizard and confirms the
// save actually persisted (the wizard advances to step 2, Template design).
// Step 2 itself (the BeePlugin WYSIWYG template body editor) is a third-party
// iframe/canvas editor and is not covered here — see uncovered-baseline.json.
test("25 - create a new email communication, basic information step (Email Management)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openEmailManagementPage(page, "new-communication");

  const mailConfigSelect = page.getByLabel("Email Configuration");
  const languageSelect = page.getByLabel("Language");

  await mailConfigSelect.click();
  const configOptionCount = await page.getByRole("option").count();
  if (configOptionCount === 0) {
    test.skip(true, "No email configuration exists in this project — precondition not met");
  }
  await page.getByRole("option").first().click();

  await languageSelect.click();
  const languageOptionCount = await page.getByRole("option").count();
  if (languageOptionCount === 0) {
    test.skip(true, "No language configured in this project — precondition not met");
  }
  await page.getByRole("option").first().click();

  // Name cannot contain spaces or hyphens per the form's own validation.
  const name = `e2eEmail${randomToken(6)}`;
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Subject").fill("E2E test communication subject");

  await page.getByRole("button", { name: "Save & continue" }).click();

  await expect(page.getByText("Template design")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Save template" })).toBeVisible();
});
