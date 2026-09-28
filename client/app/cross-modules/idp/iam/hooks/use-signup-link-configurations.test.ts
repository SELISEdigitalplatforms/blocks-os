import { describe, expect, it, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  query: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  invalidateQueries: vi.fn(),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("../services/signup-link-configuration.service", () => ({
  signupLinkConfigurationService: {
    query: h.query,
    getById: h.getById,
    create: h.create,
    update: h.update,
    archive: h.archive,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: unknown) => {
    h.useQuery(opts);
    return opts;
  },
  useMutation: (opts: unknown) => {
    h.useMutation(opts);
    return opts;
  },
  useQueryClient: () => ({ invalidateQueries: h.invalidateQueries }),
}));

import {
  useArchiveSignupLinkConfiguration,
  useCreateSignupLinkConfiguration,
  useGetSignupLinkConfigurationById,
  useGetSignupLinkConfigurations,
  useUpdateSignupLinkConfiguration,
} from "./use-signup-link-configurations";

describe("use-signup-link-configurations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds the list query key with tenant and disables without tenant via enabled flag", () => {
    const opts = useGetSignupLinkConfigurations({
      page: 0,
      pageSize: 10,
      includeInactive: false,
    }) as { queryKey: unknown[]; enabled: boolean; queryFn: () => Promise<unknown> };
    expect(opts.queryKey).toEqual([
      "signup-link-configurations",
      { page: 0, pageSize: 10, includeInactive: false },
      "tenant-1",
    ]);
    expect(opts.enabled).toBe(true);
    opts.queryFn();
    expect(h.query).toHaveBeenCalled();
  });

  it("builds the detail query", () => {
    const opts = useGetSignupLinkConfigurationById("id-1") as {
      queryKey: unknown[];
      enabled: boolean;
    };
    expect(opts.queryKey).toEqual(["signup-link-configurations", "detail", "id-1", "tenant-1"]);
    expect(opts.enabled).toBe(true);
  });

  it("create/update invalidate the list prefix", async () => {
    const create = useCreateSignupLinkConfiguration() as {
      mutationFn: (p: unknown) => Promise<unknown>;
      onSuccess: () => void;
      mutationKey: unknown[];
    };
    expect(create.mutationKey).toEqual(["signup-link-configurations", "create"]);
    h.create.mockResolvedValue({ isSuccess: true });
    await create.mutationFn({ name: "n" });
    create.onSuccess();
    expect(h.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["signup-link-configurations"],
    });

    const update = useUpdateSignupLinkConfiguration() as {
      mutationFn: (p: unknown) => Promise<unknown>;
      onSuccess: () => void;
    };
    h.update.mockResolvedValue({ isSuccess: true });
    await update.mutationFn({ itemId: "1", name: "n" });
    update.onSuccess();
    expect(h.invalidateQueries).toHaveBeenCalledTimes(2);
  });

  it("archive throws when isSuccess is false and invalidates on success", async () => {
    const archive = useArchiveSignupLinkConfiguration() as {
      mutationFn: (id: string) => Promise<unknown>;
      onSuccess: () => void;
    };
    h.archive.mockResolvedValue({ isSuccess: false, errors: { general: "nope" } });
    await expect(archive.mutationFn("1")).rejects.toMatchObject({
      errors: { general: "nope" },
    });
    h.archive.mockResolvedValue({ isSuccess: true, itemId: "1" });
    await archive.mutationFn("1");
    archive.onSuccess();
    expect(h.invalidateQueries).toHaveBeenCalled();
  });
});
