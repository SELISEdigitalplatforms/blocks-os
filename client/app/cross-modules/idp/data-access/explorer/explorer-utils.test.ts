import { describe, expect, it } from "vitest";
import type { PlatformSchemaField } from "../data-access.service";
import { buildStructurePreview, isScalarField, orderFields, schemaExposure } from "./explorer-utils";

const field = (over: Partial<PlatformSchemaField> = {}): PlatformSchemaField => ({
  name: "Name",
  type: "String",
  isArray: false,
  editAccessLevel: 0,
  ...over,
});

const levels = (read: number, write: number, edit: number, del: number) => ({
  readAccessLevel: read,
  writeAccessLevel: write,
  editAccessLevel: edit,
  deleteAccessLevel: del,
});

describe("orderFields", () => {
  it("puts the default properties first, in their usual order, and keeps the rest as they come", () => {
    const fields = ["Name", "Tags", "ItemId", "Slug", "CreatedDate"].map((name) => field({ name }));

    const { defaults, own } = orderFields(fields);

    expect(defaults.map((f) => f.name)).toEqual(["ItemId", "CreatedDate", "Tags"]);
    expect(own.map((f) => f.name)).toEqual(["Name", "Slug"]);
  });
});

describe("isScalarField", () => {
  it("allows access rules on leaf values, including Json and Enum", () => {
    expect(isScalarField(field({ type: "String" }))).toBe(true);
    expect(isScalarField(field({ type: "Json" }))).toBe(true);
    expect(isScalarField(field({ type: "Enum" }))).toBe(true);
  });

  it("refuses object properties, whose children carry the rules", () => {
    expect(isScalarField(field({ type: "OperationAccess", fields: [field({ name: "Roles" })] }))).toBe(false);
  });
});

describe("schemaExposure", () => {
  // SchemaAccessLevel: Inherited 0, User 1, Public 2, Custom 3.
  it("warns when anyone can change the data", () => {
    expect(schemaExposure(levels(3, 3, 2, 3))).toEqual({ tier: "public", reason: "Anyone can edit this schema" });
  });

  it("warns when anyone can read it", () => {
    expect(schemaExposure(levels(2, 3, 3, 3))?.reason).toBe("Anyone can read this schema");
  });

  it("warns when any requester can change it", () => {
    expect(schemaExposure(levels(3, 1, 3, 3))).toEqual({ tier: "user", reason: "Any requester can create records in this schema" });
  });

  it("says nothing for custom access everywhere, which is how system schemas are seeded", () => {
    expect(schemaExposure(levels(3, 3, 3, 3))).toBeNull();
  });
});

describe("buildStructurePreview", () => {
  it("maps types, wraps arrays and expands nested objects", () => {
    const preview = buildStructurePreview([
      field({ name: "Name" }),
      field({ name: "Count", type: "Int" }),
      field({ name: "Tags", isArray: true }),
      field({ name: "Create", type: "OperationAccess", fields: [field({ name: "Roles", isArray: true })] }),
    ]);

    expect(preview).toEqual({ Name: "string", Count: "integer", Tags: ["string"], Create: { Roles: ["string"] } });
  });
});
