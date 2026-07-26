import { describe, expect, it } from "vitest";
import { addPermissionFormDefaultValue, addPermissionFormSchema } from "./utils";

const valid = {
  name: "Read users",
  type: "2",
  resource: "users",
  resourceGroup: "IAM",
  tags: [],
  description: "",
  dependentPermissions: [],
};

describe("addPermissionFormSchema", () => {
  it("provides sensible defaults", () => {
    expect(addPermissionFormDefaultValue.name).toBe("");
    expect(addPermissionFormDefaultValue.tags).toEqual([]);
  });

  it("accepts a valid permission", () => {
    expect(addPermissionFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a resource that contains spaces", () => {
    const result = addPermissionFormSchema.safeParse({ ...valid, resource: "user list" });
    expect(result.success).toBe(false);
  });

  it("requires the service::controller::name format for type 1 permissions", () => {
    const bad = addPermissionFormSchema.safeParse({ ...valid, type: "1", resource: "users" });
    expect(bad.success).toBe(false);
    const good = addPermissionFormSchema.safeParse({
      ...valid,
      type: "1",
      resource: "svc::ctrl::name",
    });
    expect(good.success).toBe(true);
  });

  it("rejects an empty name and an over-long description", () => {
    expect(addPermissionFormSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
    expect(
      addPermissionFormSchema.safeParse({ ...valid, description: "x".repeat(151) }).success,
    ).toBe(false);
  });
});
