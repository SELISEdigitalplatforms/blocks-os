import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IEnvRepository } from "@seliseblocks/blocks-kit/models";

vi.mock("@seliseblocks/blocks-kit/utils", () => ({
  formatFullDate: () => "FMT-DATE",
}));

vi.mock("../custom-domain/dialog", () => ({
  SetCustomDomainDialog: ({
    open,
    repo,
  }: {
    open: boolean;
    repo: IEnvRepository | null;
  }) => (open ? <div data-testid="domain-dialog">dialog:{repo?.repoName}</div> : null),
}));

import { ProjectRepoTable } from "./repo-table";

const repo = (over: Partial<IEnvRepository> = {}): IEnvRepository =>
  ({
    repoName: "web-app",
    defaultDeploymentUrl: "web.default.dev",
    customDeploymentUrl: "",
    lastDeploymentDate: "2024-06-01T10:00:00",
    ...over,
  }) as IEnvRepository;

const renderTable = (data: IEnvRepository[]) =>
  render(
    <ProjectRepoTable data={data} domains={[]} projectKey="pk" projectEnv="dev" />,
  );

describe("ProjectRepoTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows an empty message when there are no repositories", () => {
    renderTable([]);
    expect(screen.getByText("No repositories found for this project.")).toBeTruthy();
  });

  it("renders repo name, deployment domain and formatted last deployment date", () => {
    renderTable([repo()]);
    expect(screen.getByText("web-app")).toBeTruthy();
    expect(screen.getByText("web.default.dev")).toBeTruthy();
    expect(screen.getByText("FMT-DATE")).toBeTruthy();
  });

  it("shows 'Not deployed' for the sentinel and empty deployment dates", () => {
    renderTable([
      repo({ repoName: "a", lastDeploymentDate: "0001-01-01T00:00:00" }),
      repo({ repoName: "b", lastDeploymentDate: "" }),
    ]);
    expect(screen.getAllByText("Not deployed").length).toBe(2);
  });

  it("renders a Set button and opens the dialog for a repo without a custom domain", async () => {
    const user = userEvent.setup();
    renderTable([repo({ repoName: "no-domain", customDeploymentUrl: "" })]);
    await user.click(screen.getByRole("button", { name: "Set" }));
    expect(screen.getByTestId("domain-dialog").textContent).toContain("no-domain");
  });

  it("shows the custom domain and enables the edit action when one is set", async () => {
    const user = userEvent.setup();
    renderTable([repo({ repoName: "has-domain", customDeploymentUrl: "custom.example.com" })]);
    expect(screen.getByText("custom.example.com")).toBeTruthy();
    const editButton = screen.getByRole("button", { name: /edit custom domain/i });
    expect((editButton as HTMLButtonElement).disabled).toBe(false);
    await user.click(editButton);
    expect(screen.getByTestId("domain-dialog").textContent).toContain("has-domain");
  });

  it("disables the edit action for a repo without a custom domain", () => {
    renderTable([repo({ customDeploymentUrl: "" })]);
    const editButton = screen.getByRole("button", { name: /edit custom domain/i });
    expect((editButton as HTMLButtonElement).disabled).toBe(true);
  });
});
