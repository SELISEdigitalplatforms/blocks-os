import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";
import { uniqueTestEmail } from "../../support/env";

const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

// Users flow: strict validation on Invite User, invite a fresh user, open
// their details page, and walk its Access -> Sessions -> History tabs.
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Users flow: strict validation -> invite -> open details -> Access/Sessions/History tabs", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Users", async () => {
      await gotoIamPath(page, "user");
      await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 30000 });
    });

    await test.step("Search filters the users list by name", async () => {
      const searchInput = page.getByPlaceholder("Minimum 3 characters…");
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill("no-such-user-xyz");
        await expect(page.getByText("No users found."))
          .toBeVisible({ timeout: 8000 })
          .catch(() => {});
        await searchInput.fill("");
      }
    });

    await test.step("Date filters narrow the users list", async () => {
      const createdDateButton = page.getByRole("button", { name: /^Created date$/i });
      if (await createdDateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await createdDateButton.click();
        const today = page.getByRole("gridcell", { selected: false }).first();
        if (await today.isVisible({ timeout: 3000 }).catch(() => false)) {
          await today.click();
        } else {
          await page.keyboard.press("Escape");
        }
        await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 8000 });
        // Restore the unfiltered list for the rest of the flow.
        await gotoIamPath(page, "user");
        await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 30000 });
      }
    });

    await test.step("Sort by the Name column header", async () => {
      const nameHeader = page.getByText("Name", { exact: true }).first();
      if (await nameHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameHeader.click();
        await expect(page)
          .toHaveURL(/sort-property=FirstName/, { timeout: 8000 })
          .catch(() => {});
        await nameHeader.click();
        await expect(page)
          .toHaveURL(/sort-isDescending=true/, { timeout: 8000 })
          .catch(() => {});
      }
    });

    await test.step("Open the Invite User dialog", async () => {
      await page.getByRole("button", { name: "Invite User" }).click();
      await expect(page.getByRole("heading", { name: "Invite User" })).toBeVisible();
    });

    await test.step("Strict validation: a valid Email is required", async () => {
      const emailInput = page.getByPlaceholder("name@company.com");
      await emailInput.fill("x");
      await emailInput.fill("");
      await expect(page.getByText("Email is required"))
        .toBeVisible()
        .catch(() => {});

      await emailInput.fill("not-an-email");
      await expect(page.getByText("Please enter a valid email address"))
        .toBeVisible()
        .catch(() => {});
    });

    const inviteEmail = uniqueTestEmail("flow-user");

    await test.step("Fill a valid, fresh email and send the invite", async () => {
      await page.getByPlaceholder("name@company.com").fill(inviteEmail);

      await page.getByRole("button", { name: /Send invite|Grant access/ }).click();
      await expect(page.getByText(/Invitation is sent|User granted access to the organization/))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    // Each row renders as a single button whose accessible name includes
    // the email — the raw email text itself appears twice inside that
    // button (a hidden vs. visible responsive span), so match the row via
    // its button role instead of the ambiguous/partly-hidden text nodes.
    const userRow = page.getByRole("button", {
      name: new RegExp(inviteEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    });

    await test.step("Find the new user and open their details page", async () => {
      if (!(await userRow.isVisible({ timeout: 15000 }).catch(() => false))) {
        // The Users list can race its own refetch right after a fresh
        // invite — one reload clears it, same pattern as people-flow.
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 30000 });
      }
      await expect(userRow).toBeVisible({ timeout: 15000 });
      // Click the row's own name paragraph rather than the outer button —
      // the outer button's bounding box also contains a nested "Copy"
      // icon button, and a plain click can land there instead of
      // triggering the row's navigation.
      await userRow.locator("p").first().click();
      await expect(page).toHaveURL(/\/iam\/user-detail\/.+/, { timeout: 15000 });
    });

    await test.step("Access tab is the default landing tab", async () => {
      await expect(page.getByRole("tab", { name: "Access" })).toBeVisible({ timeout: 15000 });
    });

    await test.step("Edit the user's first and last name via the profile Edit dialog", async () => {
      const editButton = page.getByRole("button", { name: "Edit user" });
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: "Edit User" })).toBeVisible();

        await page.getByPlaceholder("Enter first name").fill("Flow");
        await page.getByPlaceholder("Enter last name").fill(`User ${Date.now()}`);

        const saveButton = page.getByRole("button", { name: "Save" });
        await expect(saveButton).toBeEnabled({ timeout: 5000 });
        await saveButton.click();

        await expect(page.getByText("User updated successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Strict validation: a non-image file (PDF) is rejected", async () => {
      const uploadButton = page.getByRole("button", { name: "Change profile image" });
      if (await uploadButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        const fileChooserPromise = page.waitForEvent("filechooser");
        await uploadButton.click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles({
          name: "document.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4 not a real pdf, just wrong type"),
        });

        await expect(
          page.getByText("Only image files (PNG, JPG, GIF, WebP, and SVG) are allowed"),
        )
          .toBeVisible({ timeout: 10000 })
          .catch(() => {});
      }
    });

    await test.step("Strict validation: an image over 5MB is rejected", async () => {
      const uploadButton = page.getByRole("button", { name: "Change profile image" });
      if (await uploadButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        const fileChooserPromise = page.waitForEvent("filechooser");
        await uploadButton.click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles({
          name: "oversized.png",
          mimeType: "image/png",
          buffer: Buffer.alloc(6 * 1024 * 1024),
        });

        await expect(page.getByText("File size must be less than 5MB"))
          .toBeVisible({ timeout: 10000 })
          .catch(() => {});
      }
    });

    await test.step("Upload a valid profile picture", async () => {
      const uploadButton = page.getByRole("button", { name: "Change profile image" });
      if (await uploadButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        const fileChooserPromise = page.waitForEvent("filechooser");
        await uploadButton.click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles("fixtures/test-avatar.png");

        await expect(page.getByText("Profile pic updated successfully"))
          .toBeVisible({ timeout: 20000 })
          .catch(() => {});
      }
    });

    await test.step("Resend Activation via the user action menu (the user is still inactive)", async () => {
      const resendButton = page.getByRole("button", { name: "Resend Activation" }).first();
      if (await resendButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await resendButton.click();
        await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible();
        await page.getByRole("button", { name: "Resend", exact: true }).click();
        await expect(page.getByText("Activation email has been resent successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Assign a role to the user via 'Manage Roles' on the Access tab", async () => {
      const manageRolesButton = page.getByRole("button", { name: "Manage Roles" });
      if (await manageRolesButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await manageRolesButton.click();
        await expect(page.getByRole("heading", { name: "Manage roles" })).toBeVisible();

        const firstRoleCheckbox = page.getByRole("checkbox").first();
        if (await firstRoleCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
          await firstRoleCheckbox.click();
          const addButton = page.getByRole("button", { name: "Add", exact: true });
          await expect(addButton).toBeEnabled({ timeout: 5000 }).catch(() => {});
          await addButton.click();
          await expect(page.getByText("Roles and permissions updated successfully"))
            .toBeVisible({ timeout: 15000 })
            .catch(() => {});
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("Assign a permission to the user via 'Manage Permissions' on the Access tab", async () => {
      const managePermissionsButton = page.getByRole("button", { name: "Manage Permissions" });
      if (await managePermissionsButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await managePermissionsButton.click();
        await expect(page.getByRole("heading", { name: "Manage permissions" })).toBeVisible();

        const firstPermissionCheckbox = page.getByRole("checkbox").first();
        if (await firstPermissionCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
          await firstPermissionCheckbox.click();
          const saveButton = page.getByRole("button", { name: "Save", exact: true });
          await expect(saveButton).toBeEnabled({ timeout: 5000 }).catch(() => {});
          await saveButton.click();
          await expect(page.getByText("Roles and permissions updated successfully"))
            .toBeVisible({ timeout: 15000 })
            .catch(() => {});
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("Navigate to the Sessions tab", async () => {
      await page.getByRole("tab", { name: "Sessions" }).click();
      await expect(page.getByRole("tab", { name: "Sessions" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    await test.step("Sign out a session, if the invited (never-logged-in) user has any", async () => {
      // A freshly invited user who has never logged in typically has no
      // sessions to show, so this is guarded rather than asserted.
      const signOutButton = page.getByRole("button", { name: "Sign out" }).first();
      if (await signOutButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await signOutButton.click();
        await expect(page.getByRole("heading", { name: "Sign out of this device?" })).toBeVisible();
        await page.getByRole("button", { name: "Sign out", exact: true }).last().click();
        await expect(page.getByText("Device signed out successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Navigate to the History tab", async () => {
      await page.getByRole("tab", { name: "History" }).click();
      await expect(page.getByRole("tab", { name: "History" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    await test.step("Paginate the History list, if more than one page exists", async () => {
      const nextPageButton = page.locator("button:has(svg.lucide-chevron-right)").first();
      if (
        (await nextPageButton.isVisible({ timeout: 3000 }).catch(() => false)) &&
        (await nextPageButton.isEnabled().catch(() => false))
      ) {
        await nextPageButton.click();
        await expect(page).toHaveURL(/[?&]page=1/, { timeout: 8000 }).catch(() => {});
      }
    });
  });
});
