import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useImpersonateStore, useProjectStore } from "@seliseblocks/genesis-os";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { useGetProject, useGetProjectStatus } from "@/hooks/use-project";
import {
  useConnectSetup,
  useConnectTemplates,
  useRunConnectSetup,
} from "@/cross-modules/connect/hooks/use-connect";
import { resetAutoSetupAttempts } from "@/cross-modules/connect/utils/connect-auto-setup";
import { useConnectAutoSetup } from "./use-connect-auto-setup";

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: vi.fn(),
  useImpersonateStore: vi.fn(),
}));
vi.mock("@/hooks/use-project", () => ({
  useGetProject: vi.fn(),
  useGetProjectStatus: vi.fn(),
}));
vi.mock("@/cross-modules/connect/hooks/use-connect", () => ({
  connectRunSetupMutationKey: (tenantId: string) => ["connect", "run-setup", tenantId],
  useConnectSetup: vi.fn(),
  useConnectTemplates: vi.fn(),
  useRunConnectSetup: vi.fn(),
}));

const localization = { key: "localization", displayName: "Blocks Localization" };
const runSetup = vi.fn();

type Scenario = {
  projectType?: string;
  projectTenantId?: string;
  impersonatedTenantId?: string;
  isProvisioned?: boolean;
  setup?: object | null;
};

const arrange = ({
  projectType = "template",
  projectTenantId = "tenant-1",
  impersonatedTenantId = "tenant-1",
  isProvisioned = true,
  setup = null,
}: Scenario = {}) => {
  vi.mocked(useProjectStore).mockReturnValue({
    selectedProject: { tenantId: "tenant-1" },
  } as never);
  vi.mocked(useImpersonateStore).mockReturnValue({
    isImpersonated: true,
    impersonatedTenantId,
  } as never);
  vi.mocked(useGetProject).mockReturnValue({
    data: { data: { itemId: "project-1", tenantId: projectTenantId, projectType } },
  } as never);
  vi.mocked(useGetProjectStatus).mockReturnValue({ data: isProvisioned } as never);
  vi.mocked(useConnectSetup).mockReturnValue({ data: setup, isSuccess: true } as never);
  vi.mocked(useConnectTemplates).mockReturnValue({ data: [localization] } as never);
  vi.mocked(useRunConnectSetup).mockReturnValue({ mutate: runSetup } as never);
};

const render = () => renderHook(() => useConnectAutoSetup(), { wrapper: createWrapper() });

describe("useConnectAutoSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAutoSetupAttempts();
  });

  it("sets up a provisioned template environment that has no setup yet", () => {
    arrange();

    render();

    expect(runSetup).toHaveBeenCalledTimes(1);
    expect(runSetup).toHaveBeenCalledWith(localization);
  });

  it("runs only once per environment, even across remounts", () => {
    arrange();

    render().unmount();
    render();

    expect(runSetup).toHaveBeenCalledTimes(1);
  });

  it.each<[string, Scenario]>([
    ["a regular project", { projectType: "regular" }],
    ["an environment still provisioning", { isProvisioned: false }],
    ["an environment already set up", { setup: { itemId: "connect" } }],
    ["a project answer for another environment", { projectTenantId: "tenant-2" }],
    ["a session impersonating another environment", { impersonatedTenantId: "tenant-2" }],
  ])("does nothing for %s", (_, scenario) => {
    arrange(scenario);

    render();

    expect(runSetup).not.toHaveBeenCalled();
  });
});
