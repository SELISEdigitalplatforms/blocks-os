/** The default collection-naming pattern the backend falls back to when none was ever set. */
export const DEFAULT_COLLECTION_NAME_PATTERN = "sb_{SchemaName}s";

export interface IDataGatewayAnalyticsConfiguration {
  enableAnalytics: boolean;
  enableDate: string | null;
  validTill: string | null;
}

/** Which data source the project uses. The connection string itself is never returned by the backend. */
export type DataGatewayConnectionType = "Default" | "Custom";

/** Mirrors `Configuration.DomainService.DataGateway.ResponseModel.DataGatewayConfigurationResponse`. */
export interface IDataGatewayConfiguration {
  /** The tenant id (the root doc id). Sent back on an update. */
  itemId: string;
  /** `Default` = Blocks database, `Custom` = the project's own database (string kept in a secret). */
  connectionType: DataGatewayConnectionType;
  projectKey: string;
  projectShortKey: string;
  databaseName: string;
  isCollectionNameEditable: boolean;
  collectionNamePattern: string;
  analyticsConfiguration?: IDataGatewayAnalyticsConfiguration;
}

/**
 * The settings every save (create or update) carries. `connectionString` is `"default"` for the
 * Blocks database, the real string for an own database, and OMITTED on an update of a saved Custom
 * configuration to keep the stored secret (the backend never returns it).
 */
export interface IDataGatewayConfigurationMutableSettings {
  connectionString?: string;
  databaseName: string;
  isCollectionNameEditable: boolean;
  collectionNamePattern?: string;
  enableAnalytics?: boolean;
}

/** A brand new configuration: the only request that may set which project it belongs to. */
export interface IDataGatewayConfigurationCreatePayload
  extends IDataGatewayConfigurationMutableSettings {
  projectKey: string;
  updateRequest: false;
  itemId?: string;
}

/**
 * An update identifies the configuration by `itemId` - the project it belongs to is fixed once a
 * configuration exists and is not sent back.
 */
export interface IDataGatewayConfigurationUpdatePayload
  extends IDataGatewayConfigurationMutableSettings {
  itemId: string;
  updateRequest: true;
  projectKey?: string;
}

export type IDataGatewayConfigurationSavePayload =
  | IDataGatewayConfigurationCreatePayload
  | IDataGatewayConfigurationUpdatePayload;

/** Matches `BaseMutationResponse` - the same shape the existing Storage Save endpoint returns. */
export interface IDataGatewayConfigurationSaveResponse {
  isSuccess: boolean;
  errors?: Record<string, string>;
  itemId?: string;
}
