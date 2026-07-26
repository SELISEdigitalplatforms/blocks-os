import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  params: { id: "user-1", tenantGroupId: "tg-1" } as Record<string, string>,
  userResponse: undefined as unknown,
  isUserLoading: false,
  peopleData: undefined as unknown,
  isPeopleLoading: false,
  projects: undefined as unknown,
  isProjectLoading: false,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => h.navigate, useParams: () => h.params };
});
vi.mock("@seliseblocks/blocks-kit", () => ({
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
vi.mock("./people-details-tab", () => ({ PeopleDetailsTab: () => <div data-testid="details-tab" /> }));
vi.mock("./people-environments-tab", () => ({
  PeopleEnvironmentsTab: () => <div data-testid="environments-tab" />,
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
    h.params = { id: "user-1", tenantGroupId: "tg-1" };
    h.userResponse = { data: { firstName: "Ada", lastName: "Lovelace", active: true, isVerified: true } };
    h.isUserLoading = false;
    h.peopleData = { peoples: [{ sharedEnviroments: [] }], isOwner: true };
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
      peoples: [{ sharedEnviroments: [{ isInvitationConfirmed: false, isCreator: false }] }],
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

  it("switches to the environments tab", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Environments" }));
    expect(await screen.findByTestId("environments-tab")).toBeTruthy();
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
