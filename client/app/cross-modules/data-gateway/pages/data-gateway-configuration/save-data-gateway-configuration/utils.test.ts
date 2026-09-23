import { describe, expect, it } from "vitest";
import type { IDataGatewayConfiguration } from "@/cross-modules/data-gateway/models/data-gateway.model";
import {
  buildDataGatewayConfigurationFormSchema,
  dataGatewayConfigurationFormDefaultValue,
  toDataGatewayConfigurationFormValues,
} from "./utils";

const baseConfiguration: IDataGatewayConfiguration = {
  itemId: "dg-1",
  createdBy: "user-1",
  createdDate: "2026-01-01T00:00:00.000Z",
  lastUpdatedBy: "user-1",
  lastUpdatedDate: "2026-01-10T00:00:00.000Z",
  projectKey: "project-key-1",
  projectShortKey: "proj1",
  connectionString: "********",
  databaseName: "project_one_db",
  isCollectionNameEditable: true,
  collectionNamePattern: "custom_{SchemaName}",
  isDeleted: false,
  analyticsConfiguration: {
    enableAnalytics: true,
    enableDate: "2026-01-05T00:00:00.000Z",
    validTill: null,
  },
};

describe("dataGatewayConfigurationFormDefaultValue", () => {
  it("defaults to the backend's documented collection name pattern and no analytics", () => {
    expect(dataGatewayConfigurationFormDefaultValue).toEqual({
      projectKey: "",
      connectionString: "",
      databaseName: "",
      isCollectionNameEditable: false,
      collectionNamePattern: "sb_{SchemaName}s",
      enableAnalytics: false,
    });
  });
});

describe("toDataGatewayConfigurationFormValues", () => {
  it("returns the defaults when no configuration is given", () => {
    expect(toDataGatewayConfigurationFormValues(undefined)).toEqual(
      dataGatewayConfigurationFormDefaultValue,
    );
  });

  it("seeds the project key with the fallback when creating and no configuration exists", () => {
    expect(toDataGatewayConfigurationFormValues(undefined, "tenant-42")).toEqual({
      ...dataGatewayConfigurationFormDefaultValue,
      projectKey: "tenant-42",
    });
  });

  it("maps a configuration onto form values without pre-filling the masked connection string", () => {
    expect(toDataGatewayConfigurationFormValues(baseConfiguration)).toEqual({
      projectKey: "project-key-1",
      connectionString: "",
      databaseName: "project_one_db",
      isCollectionNameEditable: true,
      collectionNamePattern: "custom_{SchemaName}",
      enableAnalytics: true,
    });
  });

  it("falls back to the default collection name pattern when the configuration has none", () => {
    const configuration = { ...baseConfiguration, collectionNamePattern: "" };
    expect(toDataGatewayConfigurationFormValues(configuration).collectionNamePattern).toBe(
      "sb_{SchemaName}s",
    );
  });

  it("treats a missing analyticsConfiguration as analytics disabled", () => {
    const configuration = { ...baseConfiguration, analyticsConfiguration: undefined };
    expect(toDataGatewayConfigurationFormValues(configuration).enableAnalytics).toBe(false);
  });
});

describe("buildDataGatewayConfigurationFormSchema", () => {
  const validPayload = {
    projectKey: "project-key-1",
    connectionString: "mongodb://localhost:27017",
    databaseName: "project_one_db",
    isCollectionNameEditable: false,
    collectionNamePattern: "sb_{SchemaName}s",
    enableAnalytics: false,
  };

  it("requires a project key when creating", () => {
    const schema = buildDataGatewayConfigurationFormSchema(false);
    const result = schema.safeParse({ ...validPayload, projectKey: "" });
    expect(result.success).toBe(false);
  });

  it("does not require a project key when editing", () => {
    const schema = buildDataGatewayConfigurationFormSchema(true);
    const result = schema.safeParse({ ...validPayload, projectKey: "" });
    expect(result.success).toBe(true);
  });

  it("requires a connection string in both create and edit mode", () => {
    const createSchema = buildDataGatewayConfigurationFormSchema(false);
    const editSchema = buildDataGatewayConfigurationFormSchema(true);

    expect(createSchema.safeParse({ ...validPayload, connectionString: "" }).success).toBe(false);
    expect(editSchema.safeParse({ ...validPayload, connectionString: "" }).success).toBe(false);
  });

  it("requires a database name", () => {
    const schema = buildDataGatewayConfigurationFormSchema(false);
    const result = schema.safeParse({ ...validPayload, databaseName: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a fully filled-in payload", () => {
    const schema = buildDataGatewayConfigurationFormSchema(false);
    const result = schema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });
});
