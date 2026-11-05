import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  copy: vi.fn(),
  copies: vi.fn(),
  pages: [] as Array<{ organizations: unknown[] }>,
  fetchNextPage: vi.fn(),
  infiniteArgs: [] as unknown[],
}));

vi.mock("@blocks-communication/mail/services/email.services", () => ({
  emailService: {
    copyTemplateToOrganizations: h.copy,
    getTemplateOrganizationCopies: h.copies,
  },
}));
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@blocks-idp/iam/hooks/use-organization", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@blocks-idp/iam/hooks/use-organization")>()),
  useGetEnabledOrganizationsInfinite: (...args: unknown[]) => {
    h.infiniteArgs = args;
    return {
      data: { pages: h.pages },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
      fetchNextPage: h.fetchNextPage,
    };
  },
}));

import { useCopyTemplateToOrganizations, useOrganizationChecklistData } from "./use-template-copy";

const wrapper = (client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  const Wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return Wrapper;
};

const org = (itemId: string, name: string, extra: object = {}) => ({ itemId, name, ...extra });

describe("useCopyTemplateToOrganizations (H1)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.copy.mockResolvedValue({ isSuccess: true, itemId: "job-1" });
  });

  it("sends the request and returns the job id", async () => {
    const { result } = renderHook(() => useCopyTemplateToOrganizations(), { wrapper: wrapper() });
    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({
        templateId: "d-1",
        allOrganizations: true,
        existing: "keep",
      });
    });
    expect(h.copy).toHaveBeenCalledWith(
      { templateId: "d-1", allOrganizations: true, existing: "keep" },
      expect.anything(),
    );
    expect(response).toEqual({ isSuccess: true, itemId: "job-1" });
  });
});

describe("useOrganizationChecklistData (H3, H9)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.pages = [
      {
        organizations: [
          org("acme", "Acme Corp"),
          org("globex", "Globex"),
          org("off", "Disabled Inc", { isDisabled: true }),
          org("default", "Default"),
        ],
      },
    ];
    h.copies.mockResolvedValue({
      isSuccess: true,
      copies: [
        { organizationId: "globex", templateId: "g-1", lastUpdatedDate: "2026-10-30T09:00:00Z" },
      ],
    });
  });

  it("lists the enabled organizations except Default, from the project's organizations", () => {
    const { result } = renderHook(() => useOrganizationChecklistData(undefined), {
      wrapper: wrapper(),
    });
    expect(h.infiniteArgs[0]).toBe("tenant-1");
    expect(result.current.organizations).toEqual([
      { itemId: "acme", name: "Acme Corp" },
      { itemId: "globex", name: "Globex" },
    ]);
  });

  it("looks copies up only for the loaded organizations, once a template exists", async () => {
    const { result } = renderHook(() => useOrganizationChecklistData("d-1"), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.copies.get("globex")?.templateId).toBe("g-1"));
    expect(h.copies).toHaveBeenCalledWith("d-1", ["acme", "globex"]);
    expect(result.current.copies.has("acme")).toBe(false);
  });

  it("asks in groups of at most 25 organizations", async () => {
    h.pages = [
      {
        organizations: Array.from({ length: 30 }, (_, index) => org(`o${index}`, `Org ${index}`)),
      },
    ];
    h.copies.mockResolvedValue({ isSuccess: true, copies: [] });
    renderHook(() => useOrganizationChecklistData("d-1"), { wrapper: wrapper() });
    await waitFor(() => expect(h.copies).toHaveBeenCalledTimes(2));
    expect((h.copies.mock.calls[0][1] as string[]).length).toBe(25);
    expect((h.copies.mock.calls[1][1] as string[]).length).toBe(5);
  });

  it("asks nothing before the template exists (Q4: A)", () => {
    renderHook(() => useOrganizationChecklistData(undefined), { wrapper: wrapper() });
    expect(h.copies).not.toHaveBeenCalled();
  });
});
