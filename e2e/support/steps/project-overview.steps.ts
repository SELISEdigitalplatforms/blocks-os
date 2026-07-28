import { expect, type Page } from "@playwright/test";
import { enterConsole } from "../navigation";

type ProjectGroupResponse = Array<{
  tenantGroupId?: string;
  projects?: Array<{ tenantGroupId?: string }>;
}>;

export async function getFirstTenantGroupId(page: Page): Promise<string> {
  await enterConsole(page);

  const tenantGroupId = await page.evaluate(async () => {
    const response = await fetch("/api/Project/Gets?page=0&pageSize=1&tenantGroupId=", {
      credentials: "include",
    });
    const data = (await response.json()) as ProjectGroupResponse;
    const group = Array.isArray(data) ? data[0] : undefined;
    return group?.tenantGroupId ?? group?.projects?.[0]?.tenantGroupId ?? "";
  });

  expect(tenantGroupId, "could not resolve a tenantGroupId from Project/Gets").not.toBe("");
  return tenantGroupId;
}

export async function openProjectOverviewPage(page: Page, path: string): Promise<string> {
  const tenantGroupId = await getFirstTenantGroupId(page);
  await page.goto(`/app/project/${tenantGroupId}/${path}`);
  await page.waitForURL(new RegExp(`/app/project/${tenantGroupId}/${path}(?:/|$|[?])`), {
    timeout: 30_000,
  });
  return tenantGroupId;
}
