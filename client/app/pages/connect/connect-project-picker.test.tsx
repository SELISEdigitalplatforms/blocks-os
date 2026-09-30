import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectProjectPicker } from "./connect-project-picker";

const projects = [
  { tenantGroupId: "project-alpha", name: "Alpha Workspace" },
  { tenantGroupId: "project-beta", name: "Beta Workspace" },
  { tenantGroupId: "project-gamma", name: "Gamma Studio" },
];

describe("ConnectProjectPicker", () => {
  it("searches projects by name and selects a matching project", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    render(<ConnectProjectPicker projects={projects} value={null} onValueChange={onValueChange} />);

    const trigger = screen.getByRole("combobox", { name: "Project" });
    expect(trigger.textContent).toContain("Select a project");
    await user.click(trigger);
    expect(screen.getByText("Alpha Workspace")).toBeTruthy();
    expect(screen.getByText("Beta Workspace")).toBeTruthy();

    await user.type(screen.getByRole("combobox", { name: "Search projects" }), "beTA");
    expect(screen.queryByText("Alpha Workspace")).toBeNull();
    await user.click(screen.getByText("Beta Workspace"));

    expect(onValueChange).toHaveBeenCalledWith("project-beta");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows an empty result and clears the search when reopened", async () => {
    const user = userEvent.setup();
    render(<ConnectProjectPicker projects={projects} value="project-alpha" onValueChange={vi.fn()} />);

    const trigger = screen.getByRole("combobox", { name: "Project" });
    expect(trigger.textContent).toContain("Alpha Workspace");
    await user.click(trigger);
    await user.type(screen.getByRole("combobox", { name: "Search projects" }), "missing");
    expect(screen.getByText("No projects found.")).toBeTruthy();
    await user.keyboard("{Escape}");
    await user.click(trigger);
    expect(screen.getByText("Gamma Studio")).toBeTruthy();
  });
});
