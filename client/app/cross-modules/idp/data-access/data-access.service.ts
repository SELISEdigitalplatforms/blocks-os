import { http } from "@/lib/http/http-client";
import type { ICreatePolicyPayload, ICreatePolicyResponse, IDeletePolicyResponse, IGetPolicyResponse, ISetDataAccessResponse, ISetRowColumnPermissionPayload, IUpdatePolicyPayload } from "./gateway/models/data-service";

export type PlatformSchema = {
  id: string;
  schemaName: string;
  collectionName: string;
  service: "IAM" | "OS" | "Logic" | "Release";
  editAccessLevel: number;
  fields: Array<{ name: string; type: string; isArray: boolean; editAccessLevel: number }>;
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
