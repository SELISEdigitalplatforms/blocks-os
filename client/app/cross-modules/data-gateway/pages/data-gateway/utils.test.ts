import { describe, expect, it } from "vitest";
import type { IDataGatewayConfiguration } from "@/cross-modules/data-gateway/models/data-gateway.model";
import {
  DEFAULT_DATA_SOURCE_VALUE,
  dataGatewayConfigurationFormDefaultValue,
  dataGatewayConfigurationFormSchema,
  canOmitConnectionString,
  isCustomConnection,
  toConnectionStringPayload,
  toDataGatewayConfigurationFormValues,
} from "./utils";

const baseConfiguration: IDataGatewayConfiguration = {
  itemId: "dg-1",
  connectionType: "Custom",
  projectKey: "project-key-1",
  projectShortKey: "proj1",
  databaseName: "project_one_db",
  isCollectionNameEditable: true,
  collectionNamePattern: "custom_{SchemaName}",
  analyticsConfiguration: {
    enableAnalytics: true,
    enableDate: "2026-01-05T00:00:00.000Z",
    validTill: null,
  },
};

const defaultConfiguration: IDataGatewayConfiguration = {
  ...baseConfiguration,
  connectionType: "Default",
  databaseName: "default",
};

describe("isCustomConnection", () => {
  it("is true only for a Custom configuration", () => {
    expect(isCustomConnection(baseConfiguration)).toBe(true);
    expect(isCustomConnection(defaultConfiguration)).toBe(false);
    expect(isCustomConnection(undefined)).toBe(false);
    expect(isCustomConnection(null)).toBe(false);
  });
});

describe("canOmitConnectionString", () => {
  it("allows an empty string only for an own database that is already Custom", () => {
    expect(canOmitConnectionString("others", baseConfiguration)).toBe(true);
  });

  it("requires the string for the first Custom save and for Default -> Custom", () => {
    expect(canOmitConnectionString("others", undefined)).toBe(false);
    expect(canOmitConnectionString("others", defaultConfiguration)).toBe(false);
  });

  it("is irrelevant for the Blocks database", () => {
    expect(canOmitConnectionString("blocks", baseConfiguration)).toBe(false);
  });
});

describe("toConnectionStringPayload", () => {
  it("sends the default value for the Blocks database, whatever was typed", () => {
    expect(toConnectionStringPayload("blocks", "mongodb://x", baseConfiguration)).toBe(
      DEFAULT_DATA_SOURCE_VALUE,
    );
  });

  it("sends the trimmed entered string for an own database", () => {
    expect(toConnectionStringPayload("others", "  mongodb://x  ", defaultConfiguration)).toBe(
      "mongodb://x",
    );
  });

  it("omits the string (keep the saved one) when empty on a saved Custom configuration", () => {
    expect(toConnectionStringPayload("others", "", baseConfiguration)).toBeUndefined();
    expect(toConnectionStringPayload("others", "   ", baseConfiguration)).toBeUndefined();
  });

  it("never turns an empty value into a keep when the string is required", () => {
    expect(toConnectionStringPayload("others", "", defaultConfiguration)).toBe("");
    expect(toConnectionStringPayload("others", "", undefined)).toBe("");
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

  it("maps a custom configuration onto form values and never shows the connection string", () => {
    expect(toDataGatewayConfigurationFormValues(baseConfiguration)).toEqual({
      connectionString: "",
      databaseName: "project_one_db",
      isCollectionNameEditable: true,
      collectionNamePattern: "custom_{SchemaName}",
      enableAnalytics: true,
    });
  });

  it("blanks the database name for a Blocks-managed configuration", () => {
    const values = toDataGatewayConfigurationFormValues(defaultConfiguration);
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
