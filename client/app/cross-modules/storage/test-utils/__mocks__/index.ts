import { vi } from "vitest";
import { LINKED_SECRET_STATUS } from "@/cross-modules/secrets/models/secret.model";
import type {
  IStorageConfiguration,
  IStorageConfigurationSavePayload,
  IStorageConfigurationDeletePayload,
  IGetPreSignedUrlForUploadPayload,
  IGetPreSignedUrlForUploadResponse,
  IGetFileByFileIDPayload,
  IGetFileByFileIDResponse,
  IDeleteFilePayload,
  IDeleteResourceResponse,
  IGetFilesInfoPayload,
  IGetFilesInfoResponse,
  IGetDmsFileAndFolderPayload,
  IGetDmsFileAndFolderResponse,
  IUploadDmsFilePayload,
  IUploadDmsFileResponse,
  ICreateDmsFolderPayload,
  DmsItemType,
} from "../../models/storage.model";

const MOCK_UPDATED_DATE = "2026-01-10T00:00:00.000Z";
const MOCK_AMAZON_CONFIG_NAME = "Amazon S3 Config";
const MOCK_PROJECT_KEY = "test-project-key-123";
const MOCK_FILE_NAME = "document.pdf";
const MOCK_FILE_STORAGE_ID = "storage-001";

// ─── Storage configuration mock data ─────────────────────────────────────────

export const mockStorageConfigList: IStorageConfiguration[] = [
  {
    storageStrategy: "AWS",
    connectionStringStatus: "none",
    secretKeyStatus: "active",
    accessKeyStatus: "active",
    passwordStatus: LINKED_SECRET_STATUS.None,
    sftpSecretKeyStatus: "none",
    cloudStorageRegionEndPoint: "us-east-1",
    createdBy: "user-1",
    createdDate: "2026-01-01T00:00:00.000Z",
    itemId: "config-1",
    lastUpdatedBy: "user-1",
    lastUpdatedDate: MOCK_UPDATED_DATE,
    name: MOCK_AMAZON_CONFIG_NAME,
    organizationIds: ["org-1"],
    tags: [],
    host: null,
    port: null,
    userName: null,
    remoteBasePath: null,
  },
  {
    storageStrategy: "Azure",
    connectionStringStatus: "active",
    secretKeyStatus: "none",
    accessKeyStatus: "none",
    passwordStatus: LINKED_SECRET_STATUS.None,
    sftpSecretKeyStatus: "none",
    cloudStorageRegionEndPoint: null,
    createdBy: "user-1",
    createdDate: "2026-01-05T00:00:00.000Z",
    itemId: "config-2",
    lastUpdatedBy: "user-1",
    lastUpdatedDate: MOCK_UPDATED_DATE,
    name: "Azure Blob Config",
    organizationIds: ["org-1"],
    tags: [],
    host: null,
    port: null,
    userName: null,
    remoteBasePath: null,
  },
];

export const mockSuccessResponse = {
  isSuccess: true,
  errors: null,
  itemId: "config-1",
};

export const mockDeleteSuccessResponse: IDeleteResourceResponse = {
  isSuccess: true,
  errors: null,
};

export const mockSaveAmazonConfigPayload: IStorageConfigurationSavePayload = {
  name: MOCK_AMAZON_CONFIG_NAME,
  projectKey: MOCK_PROJECT_KEY,
  storageStrategy: "AWS",
  secretKey: "mock-aws-secret-key",
  accessKey: "AKIAIOSFODNN7EXAMPLE",
  cloudStorageRegionEndPoint: "us-east-1",
  connectionString: null,
  updateRequest: false,
  itemId: null,
  uploadUrlExpirySeconds: 600,
  downloadUrlExpirySeconds: 300,
  maxFileSizeInBytes: 5_242_880,
  uploadCompletionRequiredFor: [],
  host: null,
  port: null,
  userName: null,
  password: null,
  remoteBasePath: null,
};

export const mockSaveAzureConfigPayload: IStorageConfigurationSavePayload = {
  name: "Azure Blob Config",
  projectKey: MOCK_PROJECT_KEY,
  storageStrategy: "Azure",
  secretKey: null,
  accessKey: null,
  cloudStorageRegionEndPoint: null,
  connectionString: "DefaultEndpointsProtocol=https;AccountName=example;AccountKey=abc123==",
  updateRequest: false,
  itemId: null,
  uploadUrlExpirySeconds: 600,
  downloadUrlExpirySeconds: 300,
  maxFileSizeInBytes: 5_242_880,
  uploadCompletionRequiredFor: [],
  host: null,
  port: null,
  userName: null,
  password: null,
  remoteBasePath: null,
};

export const mockSaveSftpConfigPayload: IStorageConfigurationSavePayload = {
  name: "SFTP Config",
  projectKey: MOCK_PROJECT_KEY,
  storageStrategy: "SftpStorage",
  secretKey: null,
  accessKey: null,
  cloudStorageRegionEndPoint: null,
  connectionString: null,
  updateRequest: false,
  itemId: null,
  uploadUrlExpirySeconds: 600,
  downloadUrlExpirySeconds: 300,
  maxFileSizeInBytes: 5_242_880,
  uploadCompletionRequiredFor: [],
  host: "sftp.example.com",
  port: "22",
  userName: "sftp-user",
  password: "sftp-password",
  remoteBasePath: "/uploads",
};

export const mockSaveS3CompatibleConfigPayload: IStorageConfigurationSavePayload = {
  name: "S3 Compatible Config",
  projectKey: MOCK_PROJECT_KEY,
  storageStrategy: "S3Compatible",
  secretKey: "secret-key-example",
  accessKey: "access-key-example",
  cloudStorageRegionEndPoint: null,
  connectionString: null,
  updateRequest: false,
  itemId: null,
  uploadUrlExpirySeconds: 600,
  downloadUrlExpirySeconds: 300,
  maxFileSizeInBytes: 5_242_880,
  uploadCompletionRequiredFor: [],
  host: "s3.compatible.example.com",
  port: null,
  userName: null,
  password: null,
  remoteBasePath: null,
};

export const mockDeleteConfigPayload: IStorageConfigurationDeletePayload = {
  projectKey: MOCK_PROJECT_KEY,
  configurationName: MOCK_AMAZON_CONFIG_NAME,
};

// ─── Storage file mock data ───────────────────────────────────────────────────

export const mockGetFileByIdResponse: IGetFileByFileIDResponse = {
  url: "https://storage.example.com/files/file-1.pdf",
  accessModifier: 1,
  itemId: "file-1",
  tags: ["document"],
  metaData: { agentId: "agent-1" },
  name: "file-1.pdf",
  parentDirectoryID: "dir-1",
  systemName: "file-1-system.pdf",
  type: 1,
  typeString: "File",
  createDate: MOCK_UPDATED_DATE,
  createdBy: "user-1",
  language: "en",
  tenantId: "test-tenant-id-123",
  sizeInBytes: 204800,
  errors: null,
  isSuccess: true,
};

export const mockPreSignedUrlResponse: IGetPreSignedUrlForUploadResponse = {
  errors: null,
  isSuccess: true,
  fileId: "file-generated-001",
  uploadUrl: "https://s3.amazonaws.com/bucket/file-generated-001?X-Amz-Signature=abc123",
};

export const mockGetFilesInfoResponse: IGetFilesInfoResponse = {
  data: [
    {
      url: "https://storage.example.com/files/file-1.pdf",
      tenantId: "test-tenant-id-123",
      accessModifier: 1,
      metaData: {
        additionalProp1: { type: "string", value: "value1" },
        additionalProp2: { type: "string", value: "value2" },
        additionalProp3: { type: "string", value: "value3" },
      },
      additionalProperties: {},
      name: "file-1.pdf",
      parentDirectoryID: "dir-1",
      systemName: "file-1-system.pdf",
      type: 1,
      typeString: "File",
      currentVersion: 1,
      itemId: "file-1",
    },
  ],
  errors: null,
  totalCount: 1,
};

export const mockGetDmsFileAndFolderResponse: IGetDmsFileAndFolderResponse = {
  dmsFileAndFolderInfos: [
    {
      parentId: "",
      type: 1 as DmsItemType,
      name: MOCK_FILE_NAME,
      fileStorageId: MOCK_FILE_STORAGE_ID,
      extension: ".pdf",
      sizeInBytes: "204800",
      version: 1,
      description: "A test document",
      itemId: "dms-item-1",
      lastUpdatedDate: MOCK_UPDATED_DATE,
    },
  ],
  totalCount: 1,
};

export const mockUploadDmsFileResponse: IUploadDmsFileResponse = {
  result: [
    {
      fileStorageId: MOCK_FILE_STORAGE_ID,
      success: true,
    },
  ],
  message: "Upload successful",
  httpStatusCode: 200,
};

// ─── Storage payload mocks ────────────────────────────────────────────────────

export const mockGetFilePayload: IGetFileByFileIDPayload = {
  itemId: "file-1",
  projectKey: MOCK_PROJECT_KEY,
  configurationName: MOCK_AMAZON_CONFIG_NAME,
};

export const mockDeleteFilePayload: IDeleteFilePayload = {
  fileId: "file-1",
  projectKey: MOCK_PROJECT_KEY,
  configurationName: MOCK_AMAZON_CONFIG_NAME,
};

export const mockPreSignedUrlPayload: IGetPreSignedUrlForUploadPayload = {
  name: "upload.pdf",
  configurationName: MOCK_AMAZON_CONFIG_NAME,
  projectKey: MOCK_PROJECT_KEY,
  metaData: "{}",
  parentDirectoryId: "dir-1",
  tags: "[]",
  accessModifier: "public",
  moduleName: 1,
};

export const mockGetFilesInfoPayload: IGetFilesInfoPayload = {
  page: 1,
  pageSize: 20,
  sort: {
    property: "name",
    isDescending: false,
  },
  projectKey: MOCK_PROJECT_KEY,
};

export const mockGetDmsPayload: IGetDmsFileAndFolderPayload = {
  configurationName: MOCK_AMAZON_CONFIG_NAME,
  projectKey: MOCK_PROJECT_KEY,
  skip: 0,
  take: 20,
};

export const mockUploadDmsFilePayload: IUploadDmsFilePayload = {
  upload: [
    {
      artifactName: MOCK_FILE_NAME,
      description: "A test document",
      parentId: "",
      tags: [],
      metaData: {},
      organizationId: "org-1",
      fileStorageId: MOCK_FILE_STORAGE_ID,
      configurationName: MOCK_AMAZON_CONFIG_NAME,
    },
  ],
  projectKey: MOCK_PROJECT_KEY,
  name: MOCK_FILE_NAME,
};

export const mockCreateDmsFolderPayload: ICreateDmsFolderPayload = {
  artifactName: "New Folder",
  description: "A test folder",
  parentId: "",
  tags: [],
  metaData: {},
  organizationId: "org-1",
  fileStorageId: "",
  projectKey: MOCK_PROJECT_KEY,
  configurationName: MOCK_AMAZON_CONFIG_NAME,
};

// ─── Service factory ──────────────────────────────────────────────────────────

export const mockStorageServiceFactory = () => ({
  storageService: {
    configuration: {
      gets: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    },
    file: {
      getFileByFileId: vi.fn(),
      deleteFileByFileId: vi.fn(),
      getPreSignedUrlForUpload: vi.fn(),
      getFilesInfoUrlForUpload: vi.fn(),
      updateFileAdditionalInfo: vi.fn(),
      getFilesDownloadUrl: vi.fn(),
    },
    uploadFile: vi.fn(),
    uploadFileToLocalStorage: vi.fn(),
    uploadPublicCertificateFile: vi.fn(),
    getFilesAndFolders: vi.fn(),
    uploadDmsFile: vi.fn(),
    createDmsFolder: vi.fn(),
  },
});
