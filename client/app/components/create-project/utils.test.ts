import { beforeEach, describe, expect, it } from "vitest";
import { shortGuidGenerator, useCreateProjectFormState } from "./utils";
import { createProjectNamingFormDefaultValue } from "./form/create-project-naming-form/utils";
import { CreateProjectResourcesFormDefaultValue } from "./form/create-project-resources-form/utils";
import { createProjectEnvironmentFormDefaultValue } from "./form/create-project-environments-form/utils";

describe("shortGuidGenerator", () => {
  it("returns a string of the requested length", () => {
    expect(shortGuidGenerator(8)).toHaveLength(8);
    expect(shortGuidGenerator(0)).toHaveLength(0);
    expect(shortGuidGenerator(20)).toHaveLength(20);
  });

  it("only produces lowercase a-z characters", () => {
    const value = shortGuidGenerator(200);
    expect(value).toMatch(/^[a-z]*$/);
  });
});

describe("useCreateProjectFormState store", () => {
  beforeEach(() => {
    useCreateProjectFormState.getState().resetFormData();
  });

  it("initializes with the three default form values", () => {
    const { formData } = useCreateProjectFormState.getState();
    expect(formData).toHaveLength(3);
    expect(formData[0]).toEqual(createProjectNamingFormDefaultValue);
    expect(formData[1]).toEqual(CreateProjectResourcesFormDefaultValue);
    expect(formData[2]).toEqual(createProjectEnvironmentFormDefaultValue);
  });

  it("updates a single slice with setFormData", () => {
    const next = {
      name: "My Project",
      isAcceptBlocksTerms: true,
      isUseBlocksExclusively: true,
    };
    useCreateProjectFormState.getState().setFormData(0, next);
    expect(useCreateProjectFormState.getState().formData[0]).toEqual(next);
  });

  it("restores defaults with resetFormData", () => {
    useCreateProjectFormState.getState().setFormData(2, {
      environments: [{ value: "dev" }],
    });
    expect(useCreateProjectFormState.getState().formData[2].environments).toHaveLength(1);

    useCreateProjectFormState.getState().resetFormData();
    expect(useCreateProjectFormState.getState().formData[2]).toEqual(
      createProjectEnvironmentFormDefaultValue,
    );
  });
});
