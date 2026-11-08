import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ deleteAcross: vi.fn() }));

vi.mock("@blocks-communication/mail/services/email.services", () => ({
  emailService: { deleteTemplateAcrossOrganizations: h.deleteAcross },
}));

import { useDeleteTemplateAcrossOrganizations } from "./use-template-copy";

describe("useDeleteTemplateAcrossOrganizations (SPEC34 H2, H8)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const setup = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = renderHook(() => useDeleteTemplateAcrossOrganizations(), { wrapper });
    return { result, invalidate };
  };

  it("sends the request and refreshes the template lists", async () => {
    h.deleteAcross.mockResolvedValue({ isSuccess: true, itemId: "job-9" });
    const { result, invalidate } = setup();
    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({
        templateId: "d-order-en",
        allOrganizations: true,
      });
    });
    expect(h.deleteAcross.mock.calls[0][0]).toEqual({
      templateId: "d-order-en",
      allOrganizations: true,
    });
    expect(response).toEqual({ isSuccess: true, itemId: "job-9" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["email-templates"] });
  });

  it("refreshes the lists after a failure too, since the Default template may already be gone (C5)", async () => {
    h.deleteAcross.mockRejectedValue({ errors: { Copies: "x" } });
    const { result, invalidate } = setup();
    await act(async () => {
      await result.current
        .mutateAsync({ templateId: "d-order-en", allOrganizations: true })
        .catch(() => undefined);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["email-templates"] });
  });
});
