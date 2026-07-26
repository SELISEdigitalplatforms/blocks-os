import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectDetail } from "./project-detail";
import type { IProject } from "@/models/project.model";

const project = (over: Partial<IProject> = {}): IProject =>
  ({
    itemId: "p1",
    name: "My Project",
    tenantId: "tenant-abc-123",
    tenantGroupId: "grp-1",
    tenantSlug: "my-project",
    environment: "dev",
    applicationDomain: "https://my.seliseblocks.com",
    customDomain: "",
    isProduction: false,
    createdDate: "2025-01-01T00:00:00Z",
    lastUpdatedDate: "2025-02-01T00:00:00Z",
    ...over,
  }) as IProject;

describe("ProjectDetail", () => {
  it("renders a loading skeleton while loading", () => {
    const { container } = render(<ProjectDetail isLoading />);
    expect(container.querySelector(".animate-pulse, [class*='skeleton']")).toBeTruthy();
    expect(screen.queryByText("My Project")).toBeNull();
  });

  it("renders project fields with the non-production environment label", () => {
    render(<ProjectDetail isLoading={false} project={project()} />);
    expect(screen.getByText("My Project")).toBeTruthy();
    expect(screen.getByText("Development")).toBeTruthy();
    expect(screen.getByText("Project Slug")).toBeTruthy();
  });

  it("renders the production button for production projects", () => {
    render(<ProjectDetail isLoading={false} project={project({ environment: "prod" })} />);
    expect(screen.getByRole("button", { name: "Production" })).toBeTruthy();
  });

  it("omits the project slug row when there is no slug", () => {
    render(<ProjectDetail isLoading={false} project={project({ tenantSlug: "" })} />);
    expect(screen.queryByText("Project Slug")).toBeNull();
  });
});
