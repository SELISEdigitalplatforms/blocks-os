import { Page, expect, test } from "@playwright/test";
import { readSharedProject } from "./shared-project";

const ORPHAN_PROJECT_PATTERN = /Test Project \d+/g;

async function listOrphanProjectNames(page: Page): Promise<string[]> {
  const mainText = await page.locator("main").innerText();
  return [...new Set([...mainText.matchAll(ORPHAN_PROJECT_PATTERN)].map((match) => match[0]))];
}

const isVisibleNow = async (locator: { isVisible: (opts: { timeout: number }) => Promise<boolean> }) =>
  locator.isVisible({ timeout: 500 }).catch(() => false);

/** Make room on the console when prior runs left orphaned e2e projects behind. */
export async function freeProjectSlotIfNeeded(page: Page) {
  await ensureConsole(page);

  const welcomeHeading = page.getByRole("heading", {
    name: "Welcome to SELISE Blocks",
  });
  if (await isVisibleNow(welcomeHeading)) {
    return;
  }

  const addProjectButton = page.getByText("Add Project", { exact: true }).first();
  if (await isVisibleNow(addProjectButton)) {
    return;
  }

  const atProjectLimit = page.getByText("Please delete an existing project to create a new one.");
  if (await isVisibleNow(atProjectLimit)) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const orphanNames = await listOrphanProjectNames(page);
      if (orphanNames.length === 0) {
        break;
      }

      await deleteProject(page, orphanNames[0]).catch(() => {});
      await ensureConsole(page);

      if (await isVisibleNow(addProjectButton)) {
        return;
      }
    }
  }

  await expect(addProjectButton).toBeVisible({ timeout: 15000 });
}

export async function createProject(page: Page) {
  // ---------- Open the create-project wizard ----------
  await test.step("Start a new project", async () => {
    const welcomeHeading = page.getByRole("heading", {
      name: "Welcome to SELISE Blocks",
    });
    const createProjectButton = page.getByRole("button", {
      name: "Create a project",
    });
    const addProjectButton = page.getByText("Add Project", { exact: true }).first();
    const consoleHeading = page.getByRole("heading", {
      name: "Your Blocks Projects",
    });

    await Promise.race([
      welcomeHeading.waitFor({ state: "visible", timeout: 50000 }),
      addProjectButton.waitFor({ state: "visible", timeout: 50000 }),
      consoleHeading.waitFor({ state: "visible", timeout: 50000 }),
    ]);

    await freeProjectSlotIfNeeded(page);

    if (await welcomeHeading.isVisible().catch(() => false)) {
      await createProjectButton.click();
    } else {
      await expect(addProjectButton).toBeVisible({ timeout: 15000 });
      await addProjectButton.click();
    }
    await expect(page).toHaveURL(/\/app\/create-project$/, { timeout: 15000 });
  });

  const projectName = `Test Project ${Date.now()}`;
  await test.step("Name the project and accept the agreements", async () => {
    await expect(page.getByRole("heading", { name: "Name your project" })).toBeVisible({
      timeout: 30_000,
    });
    const nameInput = page.locator('[placeholder="Enter your project name"]:visible');
    await nameInput.fill(projectName);

    await page.getByRole("checkbox", { name: "I confirm that I will use" }).click();
    await page.getByRole("checkbox", { name: "I accept the Terms of services" }).click();

    const continueButton = page.getByRole("button", { name: "Continue", exact: true });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
  });

  await test.step("Skip optional repositories", async () => {
    await expect(page.getByRole("heading", { name: "Add resource" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  });

  await test.step("Select Development and submit", async () => {
    await expect(
      page.getByText("Select environments", { exact: true }).and(page.locator(":visible")),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByText("Development", { exact: true }).and(page.locator(":visible")).click();
    const submitButton = page.getByRole("button", { name: "Submit" });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  });

  await test.step("Wait for create success and the Environments page", async () => {
    await expect(page.getByText("Your project has been created.", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/\/app\/project\/[^/]+\/environments$/, {
      timeout: 20000,
    });
  });

  const tenantGroupId = new URL(page.url()).pathname.split("/")[3] ?? "";

  await test.step("Open the new project's Development dashboard", async () => {
    const developmentCard = page
      .locator('[class*="cursor-pointer"]')
      .filter({ has: page.getByText("Development", { exact: true }) })
      .filter({ hasText: "X-Blocks-Key:" })
      .first();

    await expect(developmentCard).toBeVisible({ timeout: 30000 });

    const setupPending = developmentCard.locator('[aria-label="Setup pending"]');
    if (await isVisibleNow(setupPending)) {
      const repairButton = developmentCard.locator('[aria-label="Repair environment"]');
      if (await isVisibleNow(repairButton)) {
        await repairButton.click();
        await page.getByRole("button", { name: "Repair" }).last().click();
      }
      await expect(setupPending).toHaveCount(0, { timeout: 60_000 });
    }

    let onDashboard = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      await developmentCard.click({ force: true, timeout: 10_000 }).catch(() => {});
      try {
        await page.waitForURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 15_000 });
        onDashboard = true;
        break;
      } catch {
        // Card click didn't land — fall through to the next attempt (or the
        // console-based fallback below once attempts are exhausted).
      }
    }

    if (!onDashboard) {
      // The in-page card click can end up unreliable (observed hanging
      // indefinitely against a stale/obscured element) — fall back to the
      // same proven path openSharedProjectDashboard already uses: go back to
      // the console and open the project by its name-card "Development" button.
      await openNamedProjectDashboard(page, projectName);
    } else {
      await expect(page).toHaveURL(/\/app\/(?!project\/)[^/]+\/dashboard/, {
        timeout: 15000,
      });
      await expect(page.getByText("X-Blocks-Key:")).toBeVisible({
        timeout: 15000,
      });
    }
  });

  const itemId = new URL(page.url()).pathname.split("/")[2] ?? "";
  if (!tenantGroupId || !itemId || itemId === "project") {
    throw new Error(
      `createProject could not resolve ids from ${page.url()} (tenantGroupId=${tenantGroupId}, itemId=${itemId})`,
    );
  }
  return { projectName, tenantGroupId, itemId };
}

/**
 * Navigate straight into the one project shared by the whole suite (created
 * once by tests/setup/project.setup.spec.ts) by its known itemId, instead of
 * creating a fresh throwaway project per test/file.
 */
export async function openSharedProjectDashboard(page: Page) {
  const fixture = readSharedProject();
  if (!fixture) {
    throw new Error(
      "Shared project fixture not found (fixtures/shared-project.json). " +
        "Did the 'project-setup' project run first?",
    );
  }

  // A raw page.goto() straight to /app/<itemId>/dashboard is unreliable on a
  // fresh page load — it can bounce to /app/console or even /login instead
  // of rendering the dashboard. Navigating from the console via the
  // project's card click (same as createProject's own flow) is the proven
  // reliable path, so use that instead of trusting the direct URL.
  await openNamedProjectDashboard(page, fixture.projectName);

  return fixture;
}

export function namedProjectCard(page: Page, projectName: string) {
  return page
    .locator("div")
    .filter({ has: page.getByText(projectName, { exact: true }) })
    .filter({
      has: page.getByRole("button", {
        name: /Development|Testing|Staging|IAT|UAT|Production|Pre-Prod|Prod Shadow/,
      }),
    })
    .last();
}

export async function openProjectOverviewPage(
  page: Page,
  tenantGroupId: string,
  subpath: "people" | "settings" | "repositories" | "environments",
) {
  await page.goto(`${new URL(page.url()).origin}/app/project/${tenantGroupId}/${subpath}`);
  await expect(page).toHaveURL(new RegExp(`/app/project/${tenantGroupId}/${subpath}`), {
    timeout: 30000,
  });
}

export async function openDashboardChildPage(page: Page, itemId: string, subpath: string) {
  await page.goto(`${new URL(page.url()).origin}/app/${itemId}/${subpath}`);
  await expect(page).toHaveURL(new RegExp(`/app/${itemId}/${subpath}`), {
    timeout: 30000,
  });
}

export async function ensureConsole(page: Page) {
  const pathname = new URL(page.url()).pathname;
  if (/\/app\/console\/?$/.test(pathname)) {
    await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
      timeout: 30000,
    });
    return;
  }

  await page.goto(`${new URL(page.url()).origin}/app/console`);
  await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
    timeout: 30000,
  });
}

export async function openNamedProjectDashboard(page: Page, projectName: string) {
  // A just-created environment can still be provisioning ("Setup pending" —
  // its console card renders greyed out and its click is a no-op while
  // that's true), so this polls with real waits in between rather than
  // failing the first time the dashboard doesn't render immediately.
  for (let attempt = 0; attempt < 6; attempt++) {
    await ensureConsole(page);
    const card = namedProjectCard(page, projectName);
    await expect(card).toBeVisible({ timeout: 30000 });
    const development = card.getByRole("button", { name: /Development/ });
    await expect(development).toBeVisible({ timeout: 15000 });

    await development.click({ force: true }).catch(() => {});
    const onDashboard = await page
      .waitForURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);

    if (onDashboard) {
      const ready = await page
        .getByText("X-Blocks-Key:")
        .isVisible({ timeout: 15_000 })
        .catch(() => false);
      if (ready) return;
    }

    if (attempt === 5) {
      await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15_000 });
      return;
    }

    await page.waitForTimeout(10_000);
  }
}

export async function openProjectConfigure(page: Page, projectName: string) {
  await ensureConsole(page);
  const card = namedProjectCard(page, projectName);
  await expect(card).toBeVisible({ timeout: 30000 });
  await card.getByRole("button", { name: /Development/ }).click({ force: true });
  await page.waitForURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 30000 });
}

export async function deleteCreatedProject(page: Page, projectName: string): Promise<boolean> {
  if (!projectName) {
    return false;
  }

  try {
    await deleteProject(page, projectName);
    return true;
  } catch {
    // Teardown must not mask the test failure that triggered it.
    return false;
  }
}

export async function deleteProject(page: Page, projectName: string) {
  if (!projectName) {
    throw new Error("deleteProject requires the created project name");
  }

  await test.step("Return to console before deleting the project", async () => {
    await ensureConsole(page);
  });

  await test.step("Open the created project from 'Your Blocks Projects'", async () => {
    await openNamedProjectDashboard(page, projectName);
  });

  // ---------- Delete button is visible to the owner on an active project ----------
  await test.step("'Delete' is visible on the Overview page for the project owner", async () => {
    await expect(
      page.getByRole("button", {
        name: "Delete",
        exact: true,
      }),
    ).toBeVisible({
      timeout: 30000,
    });
  });

  // ---------- Clicking Delete opens the exact confirmation copy ----------
  await test.step("Clicking 'Delete' opens the exact confirmation dialog", async () => {
    await page
      .getByRole("button", {
        name: "Delete",
        exact: true,
      })
      .click();

    await expect(
      page.getByRole("heading", {
        name: "Delete this environment?",
      }),
    ).toBeVisible();

    await expect(page.getByText("Are you sure you want to delete this environment?")).toBeVisible();

    await expect(
      page.getByText(
        "This will permanently delete the environment and you'll need to contact support to recover it.",
      ),
    ).toBeVisible();

    await expect(
      page.getByRole("button", {
        name: "Cancel",
      }),
    ).toBeVisible();

    await expect(
      page
        .getByRole("button", {
          name: "Delete",
          exact: true,
        })
        .last(),
    ).toBeVisible();
  });

  // ---------- Confirming delete removes the project and redirects ----------
  await test.step("Confirming delete shows the success toast and redirects to the console", async () => {
    const confirmDeleteButton = page
      .getByRole("button", {
        name: "Delete",
        exact: true,
      })
      .last();

    await confirmDeleteButton.click();

    await expect(
      page.getByText("Successfully deleted", {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 20000,
    });

    await expect(page).toHaveURL(/\/app\/console$/, {
      timeout: 20000,
    });
  });

  // ---------- Deleted project no longer appears in the project list ----------
  await test.step("The deleted project no longer appears in the project list", async () => {
    await expect(page.getByText(projectName, { exact: true })).toHaveCount(0);
  });

  return { projectName };
}
