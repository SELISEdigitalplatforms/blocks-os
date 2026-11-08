import { createWrapper } from "@/test-utils/test-providers/query-client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ assignTemplates: vi.fn() }));

vi.mock("@blocks-communication/mail/services/email.services", () => ({
  emailService: { assignTemplates: h.assignTemplates },
}));

import { useAssignTemplates } from "./use-email-template";

describe("useAssignTemplates (H10)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.assignTemplates.mockResolvedValue({ isSuccess: true, updatedCount: 3 });
  });

  it("sends the request and refreshes the template lists and the cards' usage counts", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useAssignTemplates(), { wrapper });

    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({
        configurationId: "acme-smtp",
        allMatching: false,
        templateIds: ["a1"],
      });
    });

    expect(h.assignTemplates).toHaveBeenCalledWith(
      { configurationId: "acme-smtp", allMatching: false, templateIds: ["a1"] },
      expect.anything(),
    );
    expect(response).toEqual({ isSuccess: true, updatedCount: 3 });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["email-templates"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["email-config-usage"] });
  });

  it("is usable with the shared test wrapper", () => {
    const { result } = renderHook(() => useAssignTemplates(), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(false);
  });
});
