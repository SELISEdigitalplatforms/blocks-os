import { beforeEach, describe, expect, it } from "vitest";
import { repositoryKey, shortGuidGenerator, useCreateProjectFormState } from "./utils";

describe("shortGuidGenerator", () => {
  it("returns lowercase letters of the requested length", () => {
    const id = shortGuidGenerator(5);
    expect(id).toMatch(/^[a-z]{5}$/);
  });
});

describe("repositoryKey", () => {
  it("prefers the provider id and falls back to the full name", () => {
    expect(repositoryKey({ id: 42, name: "web", full_name: "acme/web" })).toBe("42");
    expect(repositoryKey({ id: 0, name: "web", full_name: "acme/web" })).toBe("acme/web");
    expect(repositoryKey({ name: "web", full_name: "" })).toBe("web");
  });
});

describe("useCreateProjectFormState store", () => {
  beforeEach(() => {
    useCreateProjectFormState.getState().resetFormData();
  });

  it("starts empty, free tier, no project", () => {
    const s = useCreateProjectFormState.getState();
    expect(s.naming.name).toBe("");
    expect(s.selection).toEqual({ environments: [], devTier: "free", topUps: {} });
    expect(s.repositories).toEqual({ assets: [], deployments: {} });
    expect(s.createdTenantGroupId).toBeNull();
  });

  it("merges partial selection and repository updates", () => {
    const s = useCreateProjectFormState.getState();
    s.setSelection({ environments: ["dev"] });
    s.setSelection({ devTier: "paid" });
    s.setRepositories({ deployments: { "1": ["dev"] } });
    const after = useCreateProjectFormState.getState();
    expect(after.selection).toEqual({ environments: ["dev"], devTier: "paid", topUps: {} });
    expect(after.repositories.deployments).toEqual({ "1": ["dev"] });
    expect(after.repositories.assets).toEqual([]);
  });

  it("reset forgets everything, including a created project", () => {
    const s = useCreateProjectFormState.getState();
    s.setCreatedTenantGroupId("grp-1");
    s.setSelection({ environments: ["dev", "prod"] });
    s.resetFormData();
    const after = useCreateProjectFormState.getState();
    expect(after.createdTenantGroupId).toBeNull();
    expect(after.selection.environments).toEqual([]);
  });

  it("reset does not share state objects between runs", () => {
    const first = useCreateProjectFormState.getState().selection;
    useCreateProjectFormState.getState().resetFormData();
    expect(useCreateProjectFormState.getState().selection).not.toBe(first);
  });
});
