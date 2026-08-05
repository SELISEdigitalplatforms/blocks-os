import { vi } from "vitest";

export * from "./data.mock";

export const mockSuccessResponse = {
  isSuccess: true,
  errors: null,
};

export const mockSuccessResponseWithItemId = {
  isSuccess: true,
  itemId: "mock-item-id-abc123",
  errors: null,
};

export const mockErrorResponse = {
  isSuccess: false,
  errors: { general: "Something went wrong" },
};

export const mockHttpClientFactory = () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    stream: vi.fn(),
  },
  HttpError: class MockHttpError extends Error {
    status: number;
    errors: Record<string, string | string[]>;
    constructor(status: number, error: { errors: Record<string, string | string[]> }) {
      super(String(error));
      this.status = status;
      this.errors = error.errors;
    }
  },
  HttpClient: class MockHttpClient {},
});

export const mockProjectStoreFactory = () => ({
  useProjectStore: vi.fn(() => ({
    selectedProject: {
      itemId: "test-project-id",
      tenantId: "test-tenant-id-123",
      tenantGroupId: "test-tenant-group-id",
      name: "Test Project",
      applicationDomain: "https://test.seliseblocks.com",
      customDomain: "",
      isProduction: false,
      isCookieEnable: false,
      isDomainVerified: false,
      cookieDomain: "",
      isDisabled: false,
      environment: "dev",
      tenantSlug: "test-project",
      createdDate: "2025-01-01T00:00:00Z",
      lastUpdatedDate: "2025-01-01T00:00:00Z",
      createdBy: "user-id",
      lastUpdatedBy: "user-id",
      organizationIds: [],
      tags: [],
    },
    selectedTenantGroup: "test-tenant-group-id",
    projects: [],
    setSelectedProject: vi.fn(),
    resetSelectedProject: vi.fn(),
    setProjects: vi.fn(),
    resetProject: vi.fn(),
    reset: vi.fn(),
    setTenantGroup: vi.fn(),
    resetTenantGroup: vi.fn(),
  })),
});

export const mockToastFactory = () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
    toasts: [],
  })),
  toast: vi.fn(),
  showSuccessToast: vi.fn(),
  showInfoToast: vi.fn(),
  showErrorToast: vi.fn(),
});
