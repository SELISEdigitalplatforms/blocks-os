import { createWrapper } from "@/test-utils/test-providers/query-client";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ fetchEmailTemplates: vi.fn() }));

vi.mock("@blocks-communication/mail/services/email.services", () => ({
  emailService: { fetchEmailTemplates: h.fetchEmailTemplates },
}));
vi.mock("@seliseblocks/genesis-os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@seliseblocks/genesis-os")>()),
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

import { useGetEmailTemplates, useGetTemplateLanguages } from "./use-email-template";

describe("template hooks per organization", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    h.fetchEmailTemplates.mockResolvedValue({ templates: [], totalCount: 0 });
  });

  it("lists one organization's templates (H4)", async () => {
    const { result } = renderHook(
      () =>
        useGetEmailTemplates({
          pageNumber: 1,
          pageSize: 10,
          searchKey: "",
          sortProperty: "Name",
          isDescending: false,
          language: "",
          mailConfigurationId: "",
          organizationId: "acme",
        }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.fetchEmailTemplates).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: 10,
      searchKey: "",
      sortProperty: "Name",
      isDescending: false,
      language: "",
      mailConfigurationId: "",
      organizationId: "acme",
    });
  });

  it("asks for the Default organization when none is given (H5, H13)", async () => {
    const { result } = renderHook(
      () =>
        useGetEmailTemplates({
          pageNumber: 0,
          pageSize: 10,
          searchKey: "",
          sortProperty: "Name",
          isDescending: false,
          language: "",
          mailConfigurationId: "",
        }),
      {
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(h.fetchEmailTemplates).toHaveBeenCalledWith({
      pageNumber: 0,
      pageSize: 10,
      searchKey: "",
      sortProperty: "Name",
      isDescending: false,
      language: "",
      mailConfigurationId: "",
      organizationId: "default",
    });
  });

  it("finds the languages a name already has in the organization, by exact name (H10, C8)", async () => {
    h.fetchEmailTemplates.mockResolvedValue({
      totalCount: 3,
      templates: [
        { itemId: "1", name: "Order", language: "en-US" },
        { itemId: "2", name: "Order", language: "lang-b" },
        { itemId: "3", name: "OrderShipped", language: "lang-c" },
      ],
    });
    const { result } = renderHook(() => useGetTemplateLanguages("Order", "acme", true), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(["en-US", "lang-b"]);
    expect(h.fetchEmailTemplates).toHaveBeenCalledWith({
      pageNumber: 0,
      pageSize: 100,
      searchKey: "Order",
      sortProperty: "Name",
      isDescending: false,
      language: "",
      mailConfigurationId: "",
      organizationId: "acme",
    });
  });

  it("does not look languages up while the dialog is closed", () => {
    renderHook(() => useGetTemplateLanguages("Order", "acme", false), { wrapper: createWrapper() });
    expect(h.fetchEmailTemplates).not.toHaveBeenCalled();
  });
});
