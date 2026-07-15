import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { magicUrlService } from "@blocks-utilities/services/magic-url.service";
import { useDeactivateMagicUrl } from "./use-deactivate-magic-url";

vi.mock("@blocks-utilities/services/magic-url.service", () => ({
  magicUrlService: { deactivateMagicLinks: vi.fn() },
}));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ toast: (...args: unknown[]) => toast(...args) }));

describe("useDeactivateMagicUrl", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deactivates a link and shows a success toast", async () => {
    vi.mocked(magicUrlService.deactivateMagicLinks).mockResolvedValue(undefined);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useDeactivateMagicUrl(), {
      wrapper: createWrapper(),
    });

    result.current.deactivateMagicUrl("m-1", "pk", onSuccess);

    await waitFor(() =>
      expect(magicUrlService.deactivateMagicLinks).toHaveBeenCalledWith({
        linkIds: ["m-1"],
        projectKey: "pk",
      }),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
  });

  it("shows an error toast on failure", async () => {
    vi.mocked(magicUrlService.deactivateMagicLinks).mockRejectedValue(new Error("x"));
    const { result } = renderHook(() => useDeactivateMagicUrl(), {
      wrapper: createWrapper(),
    });

    result.current.deactivateMagicUrl("m-1", "pk");

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });
});
