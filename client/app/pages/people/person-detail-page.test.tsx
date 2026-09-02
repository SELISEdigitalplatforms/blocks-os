import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  isOwner: true,
  accessTabProps: {} as { isTargetOwner?: boolean },
  detailsTabProps: {} as { projectRole?: "Owner" | "Contributor" },
  navigate: vi.fn(),
  params: { id: "user-1", tenantGroupId: "tg-1" } as Record<string, string>,
  userResponse: undefined as unknown,
  isUserLoading: false,
  peopleData: undefined as unknown,
  isPeopleLoading: false,
  projects: undefined as unknown,
  isProjectLoading: false,
}));

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useNavigate: () => h.navigate, useParams: () => h.params };
});
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedTenantGroup: "tg-1" }),
}));
vi.mock("nuqs", () => {
  const parser = { withDefault: (d: unknown) => ({ defaultValue: d }) };
  return {
    parseAsBoolean: parser,
    parseAsString: parser,
    useQueryState: (_k: string, opts: { defaultValue: unknown }) =>
      React.useState(opts.defaultValue),
  };
});
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => ({ data: h.userResponse, isLoading: h.isUserLoading }),
}));
vi.mock("@/hooks/use-people", () => ({
  useGetPeople: () => ({ data: h.peopleData, isLoading: h.isPeopleLoading }),
}));
vi.mock("@/hooks/use-project", () => ({
  useGetProjects: () => ({ data: h.projects, isLoading: h.isProjectLoading }),
}));
vi.mock("./people-details-tab", () => ({
  PeopleDetailsTab: (props: { projectRole?: "Owner" | "Contributor" }) => {
    h.detailsTabProps = props;
    return <div data-testid="details-tab" />;
  },
}));
vi.mock("./people-environments-tab", () => ({
  PeopleEnvironmentsTab: () => <div data-testid="environments-tab" />,
}));
vi.mock("./people-access-tab", () => ({
  PeopleAccessTab: (props: { isTargetOwner: boolean }) => {
    h.accessTabProps = props;
    return <div data-testid="access-tab" />;
  },
}));
vi.mock("@/hooks/use-project-access", () => ({
  useProjectPermissions: () => ({ isOwner: h.isOwner, can: () => h.isOwner, menus: [] }),
}));

import { PersonDetailPage } from "./person-detail-page";

const renderPage = () =>
  render(
    <MemoryRouter>
      <PersonDetailPage />
    </MemoryRouter>,
  );

describe("PersonDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Both are mutated by individual tests, so they have to be reset or the next test inherits
    // the previous one's viewer.
    h.isOwner = true;
    h.accessTabProps = {};
    h.detailsTabProps = {};
    h.params = { id: "user-1", tenantGroupId: "tg-1" };
    h.userResponse = {
      data: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        active: true,
        isVerified: true,
      },
    };
    h.isUserLoading = false;
    h.peopleData = {
      peoples: [{ peopleDetails: { userId: "user-1" }, sharedEnviroments: [] }],
      isOwner: true,
    };
    h.isPeopleLoading = false;
    h.projects = [];
    h.isProjectLoading = false;
  });

  it("renders the person's full name and the details tab", () => {
    renderPage();
    // Name shows in both the breadcrumb and the heading.
    expect(screen.getByRole("heading", { name: "Ada Lovelace" })).toBeTruthy();
    expect(screen.getByTestId("details-tab")).toBeTruthy();
  });

  it("shows a loading skeleton while the user is loading", () => {
    h.isUserLoading = true;
    const { container } = renderPage();
    expect(container.querySelector("[class*='h-8']")).toBeTruthy();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
  });

  it("shows the pending invite badge when an unconfirmed invitation exists", () => {
    h.peopleData = {
      peoples: [{ peopleDetails: { userId: "user-1" }, sharedEnviroments: [{ isInvitationConfirmed: false, isCreator: false }] }],
      isOwner: true,
    };
    renderPage();
    expect(screen.getByText("Pending Invite")).toBeTruthy();
  });

  it("shows the inactive badge for an inactive user", () => {
    h.userResponse = { data: { firstName: "Ada", lastName: "L", active: false, isVerified: true } };
    renderPage();
    expect(screen.getByText("Inactive")).toBeTruthy();
  });

  it("shows details, environments and access on one page", () => {
    // The three former tabs held six fields, a few chips and a checkbox list between them,
    // so they are stacked rather than hidden behind a tab strip.
    renderPage();
    expect(screen.getByTestId("details-tab")).toBeTruthy();
    expect(screen.getByTestId("environments-tab")).toBeTruthy();
    expect(screen.getByTestId("access-tab")).toBeTruthy();
  });

  it("hides the access card from a contributor", () => {
    // Only an owner may read or write another member's grants.
    h.isOwner = false;
    renderPage();
    expect(screen.queryByTestId("access-tab")).toBeNull();
  });

  it("shows owner standing and hides access when the person holds a creator row", () => {
    // `role` is newer than the rows, so an owner must still be recognised from the rows alone.
    h.peopleData = {
      peoples: [{ peopleDetails: { userId: "user-1" }, sharedEnviroments: [{ isCreator: true, isInvitationConfirmed: true }] }],
      isOwner: true,
    };
    renderPage();
    expect(h.detailsTabProps.projectRole).toBe("Owner");
    expect(screen.queryByTestId("access-tab")).toBeNull();
  });

  it("shows an owner role and hides project access when the API identifies the person as an owner", () => {
    h.peopleData = {
      peoples: [
        {
          peopleDetails: { userId: "provisioned-user-id", email: "ada@example.com" },
          role: "owner",
          sharedEnviroments: [
            { enviroment: "dev", isCreator: true, isInvitationConfirmed: true },
          ],
        },
      ],
      isOwner: true,
    };

    renderPage();

    expect(h.detailsTabProps.projectRole).toBe("Owner");
    expect(screen.queryByTestId("access-tab")).toBeNull();
  });

  it("navigates back through the history when the back button is clicked", () => {
    renderPage();
    // The back button is the icon-only ghost button (no text label).
    const backButton = screen
      .getAllByRole("button")
      .find((b) => (b.textContent ?? "").trim() === "" && b.querySelector("svg"));
    fireEvent.click(backButton as HTMLElement);
    expect(h.navigate).toHaveBeenCalledWith(-1);
  });
});
