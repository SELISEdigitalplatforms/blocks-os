import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = { tab: "1", setTab: vi.fn(), resetFormData: vi.fn() };
  // Must mirror nuqs: writing the query state has to change what the *next*
  // render reads back. CreateProject's effect escapes its own re-run by
  // calling setTab("0") so the `step === 2` guard fails on the following pass
  // — with an inert setter `tab` stays "2" and the effect loops until the
  // worker dies.
  state.setTab = vi.fn((value: string) => {
    state.tab = value;
  });
  return state;
});

vi.mock("nuqs", () => ({ useQueryState: () => [h.tab, h.setTab] }));
vi.mock("@/components/create-project/utils", () => ({
  useCreateProjectFormState: () => ({ resetFormData: h.resetFormData }),
}));
vi.mock("@/components/create-project/form/create-project-naming-form/create-project-naming-form", () => ({
  CreateProjectNamingForm: () => <div data-testid="naming-form" />,
}));
vi.mock("@/components/create-project/form/create-project-resources-form/create-project-resources-form", () => ({
  CreateProjectResourcesForm: () => <div data-testid="resources-form" />,
}));
vi.mock("@/components/create-project/form/create-project-environments-form/create-project-environments-form", () => ({
  CreateProjectEnvironmentsForm: () => <div data-testid="environments-form" />,
}));

import { CreateProjectWrapper } from "./create-project";

const renderPage = () =>
  render(
    <MemoryRouter>
      <CreateProjectWrapper />
    </MemoryRouter>,
  );

describe("CreateProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.tab = "1";
  });

  it("renders the naming step first", () => {
    renderPage();
    expect(screen.getAllByTestId("naming-form").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("resources-form")).toBeNull();
  });

  it("advances to the resources step when the tab query is 2", () => {
    h.tab = "2";
    renderPage();
    // The effect completes step 1, jumps to step 2 and resets the tab.
    expect(screen.getAllByTestId("resources-form").length).toBeGreaterThan(0);
    expect(h.setTab).toHaveBeenCalledWith("0");
  });

  it("resets the form data when the close icon is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    const icons = document.querySelectorAll(".lucide-x");
    await user.click(icons[0]);
    expect(h.resetFormData).toHaveBeenCalled();
  });
});
