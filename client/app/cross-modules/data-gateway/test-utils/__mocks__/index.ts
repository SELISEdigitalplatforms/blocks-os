import { vi } from "vitest";
import type {
  IDataGatewayConfiguration,
  IDataGatewayConfigurationSavePayload,
  IDataGatewayConfigurationSaveResponse,
} from "../../models/data-gateway.model";

// ─── DataGateway configuration mock data ─────────────────────────────────────

export const mockDataGatewayConfigList: IDataGatewayConfiguration[] = [
  {
    itemId: "dg-config-1",
    createdBy: "user-1",
    createdDate: "2026-01-01T00:00:00.000Z",
    lastUpdatedBy: "user-1",
    lastUpdatedDate: "2026-01-10T00:00:00.000Z",
    projectKey: "project-key-1",
    projectShortKey: "proj1",
    connectionString: "********",
    databaseName: "project_one_db",
    isCollectionNameEditable: false,
    collectionNamePattern: "sb_{SchemaName}s",
    isDeleted: false,
    analyticsConfiguration: {
      enableAnalytics: true,
      enableDate: "2026-01-05T00:00:00.000Z",
      validTill: null,
    },
  },
  {
    itemId: "dg-config-2",
    createdBy: "user-1",
    createdDate: "2026-01-02T00:00:00.000Z",
    lastUpdatedBy: "user-1",
    lastUpdatedDate: "2026-01-11T00:00:00.000Z",
    projectKey: "project-key-2",
    projectShortKey: "proj2",
    connectionString: "********",
    databaseName: "project_two_db",
    isCollectionNameEditable: true,
    collectionNamePattern: "custom_{SchemaName}",
    isDeleted: false,
    analyticsConfiguration: {
      enableAnalytics: false,
      enableDate: null,
      validTill: null,
    },
  },
];

export const mockDataGatewayConfig: IDataGatewayConfiguration = mockDataGatewayConfigList[0];

export const mockSuccessResponse: IDataGatewayConfigurationSaveResponse = {
  isSuccess: true,
  errors: undefined,
  itemId: "dg-config-1",
};

export const mockSaveCreatePayload: IDataGatewayConfigurationSavePayload = {
  projectKey: "test-project-key-123",
  connectionString: "mongodb://localhost:27017",
  databaseName: "project_one_db",
  isCollectionNameEditable: false,
  collectionNamePattern: "sb_{SchemaName}s",
  enableAnalytics: false,
  updateRequest: false,
};

export const mockSaveUpdatePayload: IDataGatewayConfigurationSavePayload = {
  itemId: "dg-config-1",
  connectionString: "mongodb://localhost:27017",
  databaseName: "project_one_db",
  isCollectionNameEditable: false,
  collectionNamePattern: "sb_{SchemaName}s",
  enableAnalytics: true,
  updateRequest: true,
};

// ─── Service factory ──────────────────────────────────────────────────────────

export const mockDataGatewayServiceFactory = () => ({
  dataGatewayService: {
    configuration: {
      gets: vi.fn(),
      get: vi.fn(),
      save: vi.fn(),
    },
  },
});
