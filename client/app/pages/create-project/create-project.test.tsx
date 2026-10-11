import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const state = { tab: "1", setTab: vi.fn() };
  // Must mirror nuqs: writing the query state has to change what the *next* render reads back.
  // CreateProject's effect escapes its own re-run by calling setTab("0") — with an inert setter
  // `tab` stays put and the effect loops until the worker dies.
  state.setTab = vi.fn((value: string) => {
    state.tab = value;
  });
  return state;
});

vi.mock("nuqs", () => ({ useQueryState: () => [h.tab, h.setTab] }));
vi.mock(
  "@/components/create-project/form/create-project-naming-form/create-project-naming-form",
  () => ({
    CreateProjectNamingForm: () => <div data-testid="naming-form" />,
  }),
);
vi.mock(
  "@/components/create-project/form/create-project-environments-form/create-project-environments-form",
  () => ({
    CreateProjectEnvironmentsForm: () => <div data-testid="environments-form" />,
  }),
);
vi.mock(
  "@/components/create-project/form/create-project-resources-form/create-project-resources-form",
  () => ({
    CreateProjectResourcesForm: () => <div data-testid="resources-form" />,
  }),
);
vi.mock(
  "@/components/create-project/form/create-project-review-form/create-project-review-form",
  () => ({
    CreateProjectReviewForm: () => <div data-testid="review-form" />,
  }),
);

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
    expect(screen.getByTestId("naming-form")).toBeTruthy();
    expect(screen.queryByTestId("environments-form")).toBeNull();
    expect(screen.queryByTestId("resources-form")).toBeNull();
    expect(screen.queryByTestId("review-form")).toBeNull();
  });

  it.each(["2", "3"])("returning from a Git provider (?tab=%s) reopens Add repositories", (tab) => {
    h.tab = tab;
    renderPage();
    expect(screen.getByTestId("resources-form")).toBeTruthy();
    expect(h.setTab).toHaveBeenCalledWith("0");
  });

  it("ignores other tab values", () => {
    h.tab = "4";
    renderPage();
    expect(screen.getByTestId("naming-form")).toBeTruthy();
    expect(h.setTab).not.toHaveBeenCalled();
  });
});
