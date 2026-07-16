import { beforeEach, describe, expect, it } from "vitest";
import { useProjectStore } from "./useProjectStore";
import type { IProject } from "@/models/project.model";

const project = {
  itemId: "p-1",
  tenantGroupId: "tg-1",
  name: "Proj",
} as unknown as IProject;

describe("useProjectStore", () => {
  beforeEach(() => {
    useProjectStore.getState().reset();
  });

  it("starts empty", () => {
    const s = useProjectStore.getState();
    expect(s.projects).toEqual([]);
    expect(s.selectedProject).toBeNull();
    expect(s.selectedTenantGroup).toBeNull();
  });

  it("setSelectedProject also updates the tenant group", () => {
    useProjectStore.getState().setSelectedProject(project);
    expect(useProjectStore.getState().selectedProject).toEqual(project);
    expect(useProjectStore.getState().selectedTenantGroup).toBe("tg-1");
  });

  it("resetSelectedProject clears the selection", () => {
    useProjectStore.getState().setSelectedProject(project);
    useProjectStore.getState().resetSelectedProject();
    expect(useProjectStore.getState().selectedProject).toBeNull();
  });

  it("setProjects / resetProject manage the list", () => {
    useProjectStore.getState().setProjects([project]);
    expect(useProjectStore.getState().projects).toHaveLength(1);
    useProjectStore.getState().resetProject();
    expect(useProjectStore.getState().projects).toEqual([]);
  });

  it("setTennantGroup / resetTennantGroup manage the tenant group", () => {
    useProjectStore.getState().setTennantGroup("tg-2");
    expect(useProjectStore.getState().selectedTenantGroup).toBe("tg-2");
    useProjectStore.getState().resetTennantGroup();
    expect(useProjectStore.getState().selectedTenantGroup).toBeNull();
  });

  it("reset restores every field", () => {
    useProjectStore.getState().setSelectedProject(project);
    useProjectStore.getState().setProjects([project]);
    useProjectStore.getState().reset();
    const s = useProjectStore.getState();
    expect(s.projects).toEqual([]);
    expect(s.selectedProject).toBeNull();
    expect(s.selectedTenantGroup).toBeNull();
  });
});
