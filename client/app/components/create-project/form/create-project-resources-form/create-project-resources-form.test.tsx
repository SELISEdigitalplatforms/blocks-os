import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalogueMock } from "@/test-utils/__mocks__/catalogue.mock";

vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const h = vi.hoisted(() => ({
  nextStep: vi.fn(),
  previousStep: vi.fn(),
  refetchAuthorization: vi.fn().mockResolvedValue({ data: { isSuccess: false } }),
}));

vi.mock("@/components/stepper/stepper-provider", () => ({
  useStepper: () => ({
    nextStep: h.nextStep,
    previousStep: h.previousStep,
    goToStep: vi.fn(),
    currentStep: 3,
  }),
}));

vi.mock("@blocks-identifier/hooks/use-catalogue", () => ({
  useCatalogue: () => ({ data: catalogueMock(), loading: false, error: null, reload: vi.fn() }),
}));

vi.mock("@/cross-modules/devops/hooks/github-info", () => ({
  useValidateAuthorization: () => ({ data: undefined, refetch: h.refetchAuthorization }),
  useGetRepositoryUser: () => ({ data: undefined }),
}));

vi.mock("@/cross-modules/devops/components/deployment-steps/render-repos/render-provider", () => ({
  default: () => <div>provider-buttons</div>,
}));

vi.mock("@/components/repository-selection-modal/repository-selection-modal", () => ({
  RepositorySelectionModal: ({
    open,
    onSelectRepository,
  }: {
    open: boolean;
    onSelectRepository: (repo: {
      id: number;
      name: string;
      full_name: string;
      html_url: string;
    }) => void;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() =>
          onSelectRepository({
            id: 9,
            name: "jobs",
            full_name: "acme/jobs",
            html_url: "https://github.com/acme/jobs",
          })
        }
      >
        pick-acme-jobs
      </button>
    ) : null,
}));

import { CreateProjectResourcesForm } from "./create-project-resources-form";
import { useCreateProjectFormState } from "../../utils";

const repo = (id: number, name: string) => ({
  id,
  name,
  full_name: `acme/${name}`,
  html_url: `https://github.com/acme/${name}`,
});

const renderForm = () =>
  render(
    <MemoryRouter>
      <CreateProjectResourcesForm />
    </MemoryRouter>,
  );

describe("CreateProjectResourcesForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const s = useCreateProjectFormState.getState();
    s.resetFormData();
    s.setSelection({ environments: ["dev", "test"], devTier: "free" });
    s.setRepositories({
      assets: [repo(1, "web"), repo(2, "api")],
      deployments: { "1": [], "2": [] },
    });
  });

  it("shows one column per chosen environment with its branch and slot count", () => {
    renderForm();
    expect(screen.getAllByText("acme/web").length).toBeGreaterThan(0);
    // dev free: 1 slot; test: 2
    expect(screen.getByText("0 / 1")).toBeTruthy();
    expect(screen.getByText("0 / 2")).toBeTruthy();
    expect(screen.getByText("Nothing is deployed yet — you can set this up later.")).toBeTruthy();
  });

  it("ticks a cell and blocks the rest of a full environment", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("checkbox", { name: "Deploy acme/web to dev" }));
    expect(useCreateProjectFormState.getState().repositories.deployments["1"]).toEqual(["dev"]);
    expect(
      (screen.getByRole("checkbox", { name: "Deploy acme/api to dev" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText(/dev is out of slots/)).toBeTruthy();
    expect(screen.getByText("1 deployment across 2 environments.")).toBeTruthy();
  });

  it("disconnecting a repository drops its picks", async () => {
    const user = userEvent.setup();
    useCreateProjectFormState
      .getState()
      .setRepositories({ deployments: { "1": ["dev", "test"], "2": [] } });
    renderForm();
    await user.click(
      screen.getAllByRole("button", { name: "Disconnect acme/web from this project" })[0],
    );
    const { repositories } = useCreateProjectFormState.getState();
    expect(repositories.assets.map((a) => a.full_name)).toEqual(["acme/api"]);
    expect(repositories.deployments["1"]).toBeUndefined();
  });

  it("drops picks for environments that were unticked in step 2", async () => {
    useCreateProjectFormState
      .getState()
      .setRepositories({ deployments: { "1": ["dev", "prod"], "2": [] } });
    renderForm();
    await waitFor(() =>
      expect(useCreateProjectFormState.getState().repositories.deployments["1"]).toEqual(["dev"]),
    );
  });

  it("asks to connect a provider when not authorised, adds a picked repository when authorised", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getAllByRole("button", { name: /Connect a repository/ })[0]);
    expect(await screen.findByText("provider-buttons")).toBeTruthy();

    h.refetchAuthorization.mockResolvedValueOnce({ data: { isSuccess: true } });
    await user.keyboard("{Escape}");
    await user.click(screen.getAllByRole("button", { name: /Connect a repository/ })[0]);
    await user.click(await screen.findByText("pick-acme-jobs"));
    expect(
      useCreateProjectFormState.getState().repositories.assets.map((a) => a.full_name),
    ).toContain("acme/jobs");
  });

  it("Continue advances; repositories are optional", async () => {
    const user = userEvent.setup();
    useCreateProjectFormState.getState().setRepositories({ assets: [], deployments: {} });
    renderForm();
    expect(screen.getByText("No repositories connected yet.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(h.nextStep).toHaveBeenCalledTimes(1);
  });
});
