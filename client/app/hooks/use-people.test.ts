import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";
import { mockProjectStoreFactory } from "@/test-utils/__mocks__";
import { peopleService } from "@blocks-identifier/services/people.service";
import {
  useGetPeople,
  useInvitePeople,
  useResendInvitation,
  useRemoveAccess,
  useRemoveEnvironmentAccess,
  useConfirmInvitation,
  usePeopleAcceptInvitation,
  useTransferOwnership,
} from "./use-people";

vi.mock("@seliseblocks/blocks-kit", () => mockProjectStoreFactory());
vi.mock("@blocks-identifier/services/people.service", () => ({
  peopleService: {
    getPeople: vi.fn(),
    invitePeople: vi.fn(),
    resendInvitation: vi.fn(),
    removeAccess: vi.fn(),
    removeEnvironmentAccess: vi.fn(),
    confirmInvitation: vi.fn(),
    peopleAcceptInvitation: vi.fn(),
    transferOwnership: vi.fn(),
  },
}));

describe("use-people hooks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetPeople fetches with the tenant group and selects fields", async () => {
    vi.mocked(peopleService.getPeople).mockResolvedValue({
      peoples: [{ id: "u-1" }],
      peoplesTotalCount: 1,
      isOwner: true,
    } as never);
    const { result } = renderHook(
      () => useGetPeople({ page: 0, pageSize: 10, filter: "" }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(peopleService.getPeople).toHaveBeenCalledWith({
      page: 0,
      pageSize: 10,
      filter: "",
      projectGroupId: "test-tenant-group-id",
    });
    expect(result.current.data).toEqual({
      peoples: [{ id: "u-1" }],
      totalCount: 1,
      isOwner: true,
    });
  });

  const mutations: Array<{
    name: string;
    hook: () => { mutateAsync: (v: unknown) => Promise<unknown> };
    fn: ReturnType<typeof vi.fn>;
  }> = [
    { name: "useInvitePeople", hook: useInvitePeople, fn: vi.mocked(peopleService.invitePeople) },
    {
      name: "useResendInvitation",
      hook: useResendInvitation,
      fn: vi.mocked(peopleService.resendInvitation),
    },
    { name: "useRemoveAccess", hook: useRemoveAccess, fn: vi.mocked(peopleService.removeAccess) },
    {
      name: "useRemoveEnvironmentAccess",
      hook: useRemoveEnvironmentAccess,
      fn: vi.mocked(peopleService.removeEnvironmentAccess),
    },
    {
      name: "useConfirmInvitation",
      hook: useConfirmInvitation,
      fn: vi.mocked(peopleService.confirmInvitation),
    },
    {
      name: "usePeopleAcceptInvitation",
      hook: usePeopleAcceptInvitation,
      fn: vi.mocked(peopleService.peopleAcceptInvitation),
    },
    {
      name: "useTransferOwnership",
      hook: useTransferOwnership,
      fn: vi.mocked(peopleService.transferOwnership),
    },
  ];

  it.each(mutations)("$name calls its service", async ({ hook, fn }) => {
    fn.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderHook(hook, { wrapper: createWrapper() });
    await result.current.mutateAsync({ payload: "x" });
    expect(fn).toHaveBeenCalled();
  });
});
