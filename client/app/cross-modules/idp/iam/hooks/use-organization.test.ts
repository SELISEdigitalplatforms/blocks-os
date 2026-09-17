import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import {
  mockIamServiceFactory,
  mockGetOrganizationsPayload,
  mockOrganizationsResponse,
  mockGetOrganizationByIdPayload,
  mockGetOrganizationByIdResponse,
  mockSaveOrganizationPayload,
  mockOrganizationConfigResponse,
  mockSaveOrganizationConfigPayload,
} from "../../test-utils/__mocks__";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__";
import { iamService } from "@blocks-idp/iam/services/iam.service";
import {
  getEnabledOrganizationsFromPages,
  useGetEnabledOrganizationsInfinite,
  useGetOrganizations,
  useGetOrganizationById,
  useSaveOrganization,
  useGetOrganizationConfig,
  useSaveOrganizationConfig,
} from "./use-organization";

vi.mock("@blocks-idp/iam/services/iam.service", () => mockIamServiceFactory());

describe("use-organization hooks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("useGetOrganizations", () => {
    it("should fetch organizations successfully", async () => {
      vi.mocked(iamService.organization.getOrganizations).mockResolvedValue(
        mockOrganizationsResponse,
      );

      const { result } = renderHook(() => useGetOrganizations(mockGetOrganizationsPayload), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockOrganizationsResponse);
      expect(iamService.organization.getOrganizations).toHaveBeenCalledWith({
        page: mockGetOrganizationsPayload.page,
        pageSize: mockGetOrganizationsPayload.pageSize,
        projectKey: mockGetOrganizationsPayload.projectKey,
      });
    });

    it("does not fetch when the explicit enabled flag is false even if projectKey is set", async () => {
      vi.mocked(iamService.organization.getOrganizations).mockClear();
      const { result } = renderHook(
        () =>
          useGetOrganizations({
            ...mockGetOrganizationsPayload,
            enabled: false,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.fetchStatus).toBe("idle");
      expect(iamService.organization.getOrganizations).not.toHaveBeenCalled();
    });

    it("starts fetching when the explicit enabled flag flips to true", async () => {
      vi.mocked(iamService.organization.getOrganizations).mockResolvedValue(
        mockOrganizationsResponse,
      );

      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useGetOrganizations({ ...mockGetOrganizationsPayload, enabled }),
        {
          wrapper: createWrapper(),
          initialProps: { enabled: false },
        },
      );

      expect(result.current.fetchStatus).toBe("idle");

      rerender({ enabled: true });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(iamService.organization.getOrganizations).toHaveBeenCalledTimes(1);
    });

    it("falls back to disabling the query when projectKey is empty and no enabled flag is supplied", () => {
      vi.mocked(iamService.organization.getOrganizations).mockClear();
      const { result } = renderHook(
        () => useGetOrganizations({ ...mockGetOrganizationsPayload, projectKey: "" }),
        { wrapper: createWrapper() },
      );

      expect(result.current.fetchStatus).toBe("idle");
      expect(iamService.organization.getOrganizations).not.toHaveBeenCalled();
    });
  });

  describe("useGetEnabledOrganizationsInfinite", () => {
    it("fetches the next organization page and stops at the total count", async () => {
      const firstOrganization = mockOrganizationsResponse.organizations[0];
      const secondOrganization = { ...firstOrganization, itemId: "org-2", name: "Second" };
      vi.mocked(iamService.organization.getOrganizations)
        .mockResolvedValueOnce({
          ...mockOrganizationsResponse,
          organizations: [firstOrganization],
          totalCount: 2,
        })
        .mockResolvedValueOnce({
          ...mockOrganizationsResponse,
          organizations: [secondOrganization],
          totalCount: 2,
        });

      const { result } = renderHook(() => useGetEnabledOrganizationsInfinite(TEST_PROJECT_KEY), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.hasNextPage).toBe(true));
      await result.current.fetchNextPage();
      await waitFor(() => expect(result.current.hasNextPage).toBe(false));

      expect(iamService.organization.getOrganizations).toHaveBeenNthCalledWith(1, {
        projectKey: TEST_PROJECT_KEY,
        page: 0,
        pageSize: 25,
      });
      expect(iamService.organization.getOrganizations).toHaveBeenNthCalledWith(2, {
        projectKey: TEST_PROJECT_KEY,
        page: 1,
        pageSize: 25,
      });
    });
  });

  describe("getEnabledOrganizationsFromPages", () => {
    it("filters disabled organizations, removes duplicates, and includes Default", () => {
      const organization = mockOrganizationsResponse.organizations[0];
      const result = getEnabledOrganizationsFromPages([
        {
          organizations: [organization, { ...organization, itemId: "disabled", isDisabled: true }],
        },
        { organizations: [organization] },
      ]);

      expect(result.map(({ itemId }) => itemId)).toEqual([organization.itemId, "default"]);
    });
  });

  describe("useGetOrganizationById", () => {
    it("should fetch organization by ID successfully", async () => {
      vi.mocked(iamService.organization.getOrganizationById).mockResolvedValue(
        mockGetOrganizationByIdResponse,
      );

      const { result } = renderHook(() => useGetOrganizationById(mockGetOrganizationByIdPayload), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockGetOrganizationByIdResponse);
      expect(iamService.organization.getOrganizationById).toHaveBeenCalledWith(
        mockGetOrganizationByIdPayload,
      );
    });

    it("should not fetch when itemId is empty", () => {
      const { result } = renderHook(
        () => useGetOrganizationById({ itemId: "", projectKey: TEST_PROJECT_KEY }),
        { wrapper: createWrapper() },
      );

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useSaveOrganization", () => {
    it("should save organization successfully", async () => {
      vi.mocked(iamService.organization.saveOrganization).mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useSaveOrganization(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockSaveOrganizationPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(iamService.organization.saveOrganization).toHaveBeenCalledWith(
        mockSaveOrganizationPayload,
        expect.anything(),
      );
    });
  });

  describe("useGetOrganizationConfig", () => {
    it("should fetch organization config successfully", async () => {
      vi.mocked(iamService.organization.getOrganizationConfig).mockResolvedValue(
        mockOrganizationConfigResponse,
      );

      const { result } = renderHook(() => useGetOrganizationConfig(TEST_PROJECT_KEY), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockOrganizationConfigResponse);
      expect(iamService.organization.getOrganizationConfig).toHaveBeenCalledWith(TEST_PROJECT_KEY);
    });

    it("should not fetch when projectKey is empty", () => {
      const { result } = renderHook(() => useGetOrganizationConfig(""), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe("idle");
    });
  });

  describe("useSaveOrganizationConfig", () => {
    it("should save organization config successfully", async () => {
      vi.mocked(iamService.organization.saveOrganizationConfig).mockResolvedValue(
        undefined as never,
      );

      const { result } = renderHook(() => useSaveOrganizationConfig(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(mockSaveOrganizationConfigPayload);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(iamService.organization.saveOrganizationConfig).toHaveBeenCalledWith(
        mockSaveOrganizationConfigPayload,
      );
    });
  });
});
