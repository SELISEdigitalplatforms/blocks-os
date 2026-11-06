import { vi } from "vitest";

export * from "./project-store.mock";
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
