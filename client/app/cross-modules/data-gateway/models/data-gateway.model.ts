/** The default collection-naming pattern the backend falls back to when none was ever set. */
export const DEFAULT_COLLECTION_NAME_PATTERN = "sb_{SchemaName}s";

export interface IDataGatewayAnalyticsConfiguration {
  enableAnalytics: boolean;
  enableDate: string | null;
  validTill: string | null;
}

/** Mirrors `Configuration.DomainService.DataGateway.Entities.DataGatewayConfiguration`. */
export interface IDataGatewayConfiguration {
  itemId: string;
  createdBy: string;
  createdDate: string;
  lastUpdatedBy: string;
  lastUpdatedDate: string;
  projectKey: string;
  projectShortKey: string;
  /**
   * Decoded by the backend on every read - unlike Storage's masked secrets, this is the real
   * value (or the "default" sentinel meaning the platform-managed database). Named
   * `dbConnectionString` (not `connectionString`) to match the stored entity's actual field,
   * shared with blocks-data's own DataServiceConfiguration document.
   */
  dbConnectionString: string;
  databaseName: string;
  isCollectionNameEditable: boolean;
  collectionNamePattern: string;
  isDeleted: boolean;
  analyticsConfiguration?: IDataGatewayAnalyticsConfiguration;
}

/**
 * The settings every save (create or update) carries. Unlike Storage's provider identity, a
 * DataGateway configuration's connection details are the very thing an update exists to change,
 * so - unusually - `connectionString` and `databaseName` are required on both a create and an
 * update, not just on create.
 */
export interface IDataGatewayConfigurationMutableSettings {
  connectionString: string;
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
