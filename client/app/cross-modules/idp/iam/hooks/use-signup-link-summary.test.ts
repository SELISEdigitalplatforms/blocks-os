import { describe, expect, it, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getSummary: vi.fn(),
  useQuery: vi.fn(),
  tenantId: "tenant-1" as string | undefined,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: h.tenantId } }),
}));

vi.mock("../services/signup-link-summary.service", () => ({
  signupLinkSummaryService: {
    getSummary: h.getSummary,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: Symbol("keepPreviousData"),
  useQuery: (opts: unknown) => {
    h.useQuery(opts);
    return opts;
  },
}));

import { useSignupLinkSummary } from "./use-signup-link-summary";

describe("useSignupLinkSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.tenantId = "tenant-1";
  });

  it("disables the query when configurationId is empty", () => {
    const opts = useSignupLinkSummary({ configurationId: "" }) as {
      enabled: boolean;
      queryKey: unknown[];
    };
    expect(opts.enabled).toBe(false);
    expect(opts.queryKey[0]).toBe("signup-link-summary");
  });

  it("disables the query when no tenant is selected (C11)", () => {
    h.tenantId = undefined;
    const opts = useSignupLinkSummary({ configurationId: "c1" }) as { enabled: boolean };
    expect(opts.enabled).toBe(false);
  });

  it("enables when tenant and configurationId are present", () => {
    const opts = useSignupLinkSummary({
      configurationId: "c1",
      fromUtc: "2026-01-01T00:00:00.000Z",
    }) as { enabled: boolean; queryKey: unknown[] };
    expect(opts.enabled).toBe(true);
    expect(opts.queryKey).toEqual([
      "signup-link-summary",
      {
        configurationId: "c1",
        fromUtc: "2026-01-01T00:00:00.000Z",
        toUtc: undefined,
      },
      "tenant-1",
    ]);
  });

  it("throws when queryFn runs without configurationId", () => {
    const opts = useSignupLinkSummary({ configurationId: "" }) as {
      queryFn: () => Promise<unknown>;
    };
    expect(() => opts.queryFn()).toThrow("configurationId is required");
  });

  it("calls getSummary from queryFn when configurationId is set", async () => {
    h.getSummary.mockResolvedValue({ configurationId: "c1" });
    const opts = useSignupLinkSummary({ configurationId: "c1" }) as {
      queryFn: () => Promise<unknown>;
    };
    await opts.queryFn();
    expect(h.getSummary).toHaveBeenCalledWith({ configurationId: "c1" });
  });
});
