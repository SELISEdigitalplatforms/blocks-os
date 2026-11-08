import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  config: undefined as undefined | { isMultiOrgEnabled: boolean },
  configLoading: false,
  projectKeys: [] as string[],
  query: { value: "default", set: vi.fn() },
}));

vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", () => ({
  useGetOrganizationConfig: (projectKey: string) => {
    h.projectKeys.push(projectKey);
    return { data: h.config, isLoading: h.configLoading };
  },
}));
vi.mock("nuqs", () => ({
  parseAsString: { withDefault: (value: string) => ({ default: value }) },
  useQueryState: (key: string, parser: { default: string }) => {
    expect(key).toBe("emailOrg");
    expect(parser.default).toBe("default");
    return [h.query.value, h.query.set];
  },
}));

import { useEmailOrganization } from "./use-email-organization";

describe("useEmailOrganization", () => {
  beforeEach(() => {
    h.config = undefined;
    h.configLoading = false;
    h.projectKeys = [];
    h.query = { value: "default", set: vi.fn() };
  });

  it("is off when the project's organization config says multi-org is off (H12)", () => {
    h.config = { isMultiOrgEnabled: false };
    const { result } = renderHook(() => useEmailOrganization());
    expect(result.current.isMultiOrgEnabled).toBe(false);
    expect(h.projectKeys).toContain("tenant-1");
  });

  it("is off while the config is missing or loading", () => {
    h.configLoading = true;
    const { result } = renderHook(() => useEmailOrganization());
    expect(result.current.isMultiOrgEnabled).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it("keeps the selected organization in the URL, Default organization first (H7)", () => {
    h.config = { isMultiOrgEnabled: true };
    h.query.value = "acme";
    const { result } = renderHook(() => useEmailOrganization());
    expect(result.current.isMultiOrgEnabled).toBe(true);
    expect(result.current.selectedOrganizationId).toBe("acme");
    act(() => result.current.setSelectedOrganizationId("globex"));
    expect(h.query.set).toHaveBeenCalledWith("globex");
  });

  it("lists only the Default organization when multi-org is off, whatever the URL says", () => {
    h.config = { isMultiOrgEnabled: false };
    h.query.value = "acme";
    const { result } = renderHook(() => useEmailOrganization());
    expect(result.current.selectedOrganizationId).toBe("default");
  });
});
