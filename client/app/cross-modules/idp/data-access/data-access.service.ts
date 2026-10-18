import { http } from "@/lib/http/http-client";
import type { ICreatePolicyPayload, ICreatePolicyResponse, IDeletePolicyResponse, IGetPolicyResponse, ISetDataAccessResponse, ISetRowColumnPermissionPayload, IUpdatePolicyPayload } from "./gateway/models/data-service";

export const PLATFORM_SERVICES = ["IAM", "OS", "Logic", "Release"] as const;
export type PlatformService = (typeof PLATFORM_SERVICES)[number];

/** One property of a platform schema. Nested object properties carry their own `fields`. */
export type PlatformSchemaField = {
  name: string;
  type: string;
  isArray: boolean;
  enumValues?: string[];
  isPIIData?: boolean;
  isUniqueData?: boolean;
  description?: string | null;
  readAccessLevel?: number;
  writeAccessLevel?: number;
  editAccessLevel: number;
  deleteAccessLevel?: number;
  fields?: PlatformSchemaField[];
};

export type PlatformSchema = {
  id: string;
  schemaName: string;
  collectionName: string;
  service: PlatformService;
  readAccessLevel: number;
  writeAccessLevel: number;
  editAccessLevel: number;
  deleteAccessLevel: number;
  fields: PlatformSchemaField[];
};

type Response<T> = { isSuccess: boolean; data: T; errors?: unknown; message?: string };

export const platformDataAccessService = {
  getSchemas: () => http.get<Response<PlatformSchema[]>>("/api/PlatformDataAccess/Schemas"),
  getPolicies: (schemaId: string) => http.get<IGetPolicyResponse>(`/api/PlatformDataAccess/Policies?schemaId=${encodeURIComponent(schemaId)}`),
  configure: (payload: ISetRowColumnPermissionPayload) => http.post<ISetDataAccessResponse>("/api/PlatformDataAccess/Configure", payload),
  create: (payload: ICreatePolicyPayload) => http.post<ICreatePolicyResponse>("/api/PlatformDataAccess/Create", payload),
  update: (payload: IUpdatePolicyPayload) => http.post<ICreatePolicyResponse>("/api/PlatformDataAccess/Update", payload),
  delete: (itemId: string) => http.delete<IDeletePolicyResponse>(`/api/PlatformDataAccess/Delete?itemId=${encodeURIComponent(itemId)}`),
};
