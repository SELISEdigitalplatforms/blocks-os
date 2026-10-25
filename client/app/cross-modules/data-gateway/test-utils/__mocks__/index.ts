import { vi } from "vitest";
import type {
  IDataGatewayConfiguration,
  IDataGatewayConfigurationSavePayload,
  IDataGatewayConfigurationSaveResponse,
} from "../../models/data-gateway.model";

// ─── DataGateway configuration mock data ─────────────────────────────────────
// There is at most one configuration, so there is only ever one mock instance - no list.

export const mockDataGatewayConfig: IDataGatewayConfiguration = {
  itemId: "dg-config-1",
  connectionType: "Custom",
  projectKey: "project-key-1",
  projectShortKey: "proj1",
  databaseName: "project_one_db",
  isCollectionNameEditable: false,
  collectionNamePattern: "sb_{SchemaName}s",
  analyticsConfiguration: {
    enableAnalytics: true,
    enableDate: "2026-01-05T00:00:00.000Z",
    validTill: null,
  },
};

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
      get: vi.fn(),
      save: vi.fn(),
    },
  },
});
