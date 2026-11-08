import { createWrapper } from "@/test-utils/test-providers/query-client";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getEmailSecretConfigs: vi.fn(),
  getConfigurationUsage: vi.fn(),
}));

vi.mock("@blocks-communication/mail/services/email.services", () => ({
  emailService: {
    getEmailSecretConfigs: h.getEmailSecretConfigs,
    getConfigurationUsage: h.getConfigurationUsage,
  },
}));
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

import { useGetEmailConfigUsage, useGetEmailSecretConfigs } from "./use-email-config";

describe("mail configuration hooks per organization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.getEmailSecretConfigs.mockResolvedValue({ configurations: [] });
  });

  it("lists every configuration when no organization is given (H5)", async () => {
    const { result } = renderHook(() => useGetEmailSecretConfigs(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.getEmailSecretConfigs).toHaveBeenCalledWith(0, 10, undefined);
  });

  it("asks for one organization's configurations plus the Default organization's (H4)", async () => {
    const { result } = renderHook(() => useGetEmailSecretConfigs("acme"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.getEmailSecretConfigs).toHaveBeenCalledWith(0, 10, "acme");
  });

  it("waits while disabled", () => {
    renderHook(() => useGetEmailSecretConfigs(undefined, false), { wrapper: createWrapper() });
    expect(h.getEmailSecretConfigs).not.toHaveBeenCalled();
  });

  it("fetches a configuration's usage only when asked to (H11)", async () => {
    h.getConfigurationUsage.mockResolvedValue(4);
    const idle = renderHook(() => useGetEmailConfigUsage("cfg-1", false), {
      wrapper: createWrapper(),
    });
    expect(h.getConfigurationUsage).not.toHaveBeenCalled();
    idle.unmount();

    const { result } = renderHook(() => useGetEmailConfigUsage("cfg-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.data).toBe(4));
    expect(h.getConfigurationUsage).toHaveBeenCalledWith("cfg-1");
  });
});
