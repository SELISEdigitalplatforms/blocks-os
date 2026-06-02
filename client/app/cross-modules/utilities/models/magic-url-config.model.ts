export const MAGIC_URL_CONFIG_SECRET_KEY = "magic-url" as const;

export interface IMagicUrlConfig {
  itemId: string;
  createdDate?: string;
  lastUpdatedDate?: string;
  createdBy?: string;
  lastUpdatedBy?: string;
  organizationIds?: string[];
  tags?: string[];
  contextName: string;
  shortUrlBase: string;
}

export interface IGetMagicUrlConfigsPayload {
  projectKey: string;
  page: number;
  pageSize: number;
  searchText?: string;
}

export interface IGetMagicUrlConfigsResponse {
  configurations: IMagicUrlConfig[];
  totalCount: number;
}

export interface ISaveMagicUrlConfigPayload {
  itemId?: string;
  contextName: string;
  shortUrlBase: string;
  projectKey: string;
}

export interface ISaveMagicUrlConfigResponse {
  errors: null | unknown;
  isSuccess: boolean;
  itemId: string;
}
