import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PeopleEnvironmentsTab } from "./people-environments-tab";
import type { User } from "@blocks-idp/iam/models/user";
import type { PeopleGroupedByEnvironments } from "@/models/people";
import type { IProjectGroup } from "@/models/project.model";

const removeEnvAsync = vi.fn();
const inviteAsync = vi.fn();
let removePending = false;
let invitePending = false;

vi.mock("@/hooks/use-people", () => ({
  useRemoveEnvironmentAccess: () => ({ mutateAsync: removeEnvAsync, isPending: removePending }),
  useInvitePeople: () => ({ mutateAsync: inviteAsync, isPending: invitePending }),
}));

const showErrorToast = vi.fn();
const showSuccessToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...args: unknown[]) => showErrorToast(...args),
  showSuccessToast: (...args: unknown[]) => showSuccessToast(...args),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: Object.assign(
    () => ({ selectedTenantGroup: "group-1" }),
    { getState: () => ({ selectedTenantGroup: "group-1" }) },
  ),
}));

vi.mock("./invite-people-utils", () => ({
  buildInvitePeoplePayload: (map: Record<string, string[]>, groupId: string) => ({
    map,
    groupId,
  }),
}));

const user: User = { itemId: "u1", email: "jane@example.com" } as unknown as User;

const peopleData: PeopleGroupedByEnvironments[] = [
  {
    sharedEnviroments: [
      { enviroment: "dev", tenantId: "t-dev", isCreator: false },
      { enviroment: "test", tenantId: "t-test", isCreator: false },
    ],
  },
] as unknown as PeopleGroupedByEnvironments[];

const environmentList: IProjectGroup[] = [
  {
    tenantGroupId: "group-1",
    projects: [
      { environment: "dev", tenantId: "t-dev" },
      { environment: "test", tenantId: "t-test" },
      { environment: "stg", tenantId: "t-stg" },
    ],
    nonSharedProject: [{ environment: "uat", tenantId: "t-uat" }],
  },
] as unknown as IProjectGroup[];

describe("PeopleEnvironmentsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removePending = false;
    invitePending = false;
  });

  it("shows fallback card when no user is provided", () => {
    render(<PeopleEnvironmentsTab />);
    expect(screen.getByText("User data not available")).toBeTruthy();
  });

  it("lists environments the user has and lacks access to", () => {
    render(
      <PeopleEnvironmentsTab
        user={user}
        peopleData={peopleData}
        environmentList={environmentList}
      />,
    );
    expect(screen.getByText("Environment Access")).toBeTruthy();
    expect(screen.getByText("With access to")).toBeTruthy();
    // dev + test shared -> with access
    expect(screen.getByText("Development")).toBeTruthy();
    expect(screen.getByText("Testing")).toBeTruthy();
    // stg + uat -> without access
    expect(screen.getByText("Staging")).toBeTruthy();
    expect(screen.getByText("UAT")).toBeTruthy();
  });

  it("does not render action buttons when viewer is not owner", () => {
    render(
      <PeopleEnvironmentsTab
        user={user}
        peopleData={peopleData}
        environmentList={environmentList}
        isViewerOwner={false}
      />,
    );
    expect(screen.queryByLabelText(/Remove access from/)).toBeNull();
    expect(screen.queryByLabelText(/Grant access to/)).toBeNull();
  });

  it("grants access to an environment through the confirmation modal", async () => {
    inviteAsync.mockResolvedValue({ isSuccess: true });
    render(
      <PeopleEnvironmentsTab
        user={user}
        peopleData={peopleData}
        environmentList={environmentList}
        isViewerOwner
      />,
    );
    await userEvent.click(screen.getByLabelText("Grant access to Staging"));
    expect(screen.getByText("Grant Access")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Grant" }));
    await waitFor(() => expect(inviteAsync).toHaveBeenCalledTimes(1));
    expect(inviteAsync).toHaveBeenCalledWith({
      map: { "jane@example.com": ["t-stg"] },
      groupId: "group-1",
    });
    expect(showSuccessToast).toHaveBeenCalledWith({
      description: "Access granted to Staging",
    });
  });

  it("removes access to an environment and shows a success toast", async () => {
    removeEnvAsync.mockResolvedValue({ isSuccess: true });
    render(
      <PeopleEnvironmentsTab
        user={user}
        peopleData={peopleData}
        environmentList={environmentList}
        isViewerOwner
      />,
    );
    await userEvent.click(screen.getByLabelText("Remove access from Development"));
    expect(screen.getByText("Remove Access")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeEnvAsync).toHaveBeenCalledTimes(1));
    expect(removeEnvAsync).toHaveBeenCalledWith({
      email: "jane@example.com",
      tenantIds: ["t-dev"],
      groupId: "group-1",
    });
    expect(showSuccessToast).toHaveBeenCalledWith({
      description: "Access removed from Development",
    });
  });

  it("surfaces an error toast when the grant request fails", async () => {
    inviteAsync.mockResolvedValue({ isSuccess: false });
    render(
      <PeopleEnvironmentsTab
        user={user}
        peopleData={peopleData}
        environmentList={environmentList}
        isViewerOwner
      />,
    );
    await userEvent.click(screen.getByLabelText("Grant access to Staging"));
    await userEvent.click(screen.getByRole("button", { name: "Grant" }));
    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith({
        errors: "Failed to grant access to Staging",
      }),
    );
  });
});
