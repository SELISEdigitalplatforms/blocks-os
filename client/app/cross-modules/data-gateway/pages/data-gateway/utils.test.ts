import { describe, expect, it } from "vitest";
import type { IDataGatewayConfiguration } from "@/cross-modules/data-gateway/models/data-gateway.model";
import {
  DEFAULT_DATA_SOURCE_VALUE,
  dataGatewayConfigurationFormDefaultValue,
  dataGatewayConfigurationFormSchema,
  isDefaultConnection,
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
  connectionString: "mongodb://localhost:27017",
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

describe("isDefaultConnection", () => {
  it("treats a missing value as the platform default", () => {
    expect(isDefaultConnection(undefined)).toBe(true);
    expect(isDefaultConnection(null)).toBe(true);
    expect(isDefaultConnection("")).toBe(true);
  });

  it("treats the sentinel value as the platform default", () => {
    expect(isDefaultConnection(DEFAULT_DATA_SOURCE_VALUE)).toBe(true);
  });

  it("treats any other value as a custom connection", () => {
    expect(isDefaultConnection("mongodb://localhost:27017")).toBe(false);
  });
});

describe("dataGatewayConfigurationFormDefaultValue", () => {
  it("defaults to the backend's documented collection name pattern and no analytics", () => {
    expect(dataGatewayConfigurationFormDefaultValue).toEqual({
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
    expect(toDataGatewayConfigurationFormValues(null)).toEqual(
      dataGatewayConfigurationFormDefaultValue,
    );
  });

  it("maps a custom configuration onto form values", () => {
    expect(toDataGatewayConfigurationFormValues(baseConfiguration)).toEqual({
      connectionString: "mongodb://localhost:27017",
      databaseName: "project_one_db",
      isCollectionNameEditable: true,
      collectionNamePattern: "custom_{SchemaName}",
      enableAnalytics: true,
    });
  });

  it("blanks the connection string and database name for a platform-managed configuration", () => {
    const configuration = {
      ...baseConfiguration,
      connectionString: DEFAULT_DATA_SOURCE_VALUE,
      databaseName: DEFAULT_DATA_SOURCE_VALUE,
    };
    const values = toDataGatewayConfigurationFormValues(configuration);
    expect(values.connectionString).toBe("");
    expect(values.databaseName).toBe("");
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

describe("dataGatewayConfigurationFormSchema", () => {
  it("requires a collection name pattern", () => {
    const result = dataGatewayConfigurationFormSchema.safeParse({
      ...dataGatewayConfigurationFormDefaultValue,
      collectionNamePattern: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts blank connection string/database name (the Blocks-managed case)", () => {
    const result = dataGatewayConfigurationFormSchema.safeParse(
      dataGatewayConfigurationFormDefaultValue,
    );
    expect(result.success).toBe(true);
  });
});
