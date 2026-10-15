import { getRuntimeEnv } from "@/lib/runtime-env";
import { http } from "@/lib/http/http-client";
import type { ApiResponse, PlatformSchema, Policy, PolicyPayload } from "./models";

const dataApi = `${getRuntimeEnv("BLOCKS_DATA_BASE_URL").replace(/\/$/, "")}/api`;

export const platformDataAccessService = {
  getSchemas: () => http.get<ApiResponse<PlatformSchema[]>>(`${dataApi}/schemas/platform`),
  getPolicies: (schemaName: string, schemaId: string) => {
    const query = new URLSearchParams({ schemaName, schemaId });
    return http.get<ApiResponse<Policy[]>>(`${dataApi}/data-access/policy/get?${query}`);
  },
  setCustomUpdateAccess: (schemaId: string, policyType: number, fieldNames: string[], projectKey: string) =>
    http.post<ApiResponse<unknown>>(`${dataApi}/data-access/security/change`, {
      schemaId,
      operation: 2,
      policyType,
      fieldNames,
      accessLevel: 3,
      projectKey,
    }),
  createPolicy: (payload: PolicyPayload) =>
    http.post<ApiResponse<unknown>>(`${dataApi}/data-access/policy/create`, payload),
  updatePolicy: (payload: PolicyPayload) =>
    http.post<ApiResponse<unknown>>(`${dataApi}/data-access/policy/update`, payload),
  deletePolicy: (itemId: string) => {
    const query = new URLSearchParams({ itemId });
    return http.delete<ApiResponse<unknown>>(`${dataApi}/data-access/policy/delete?${query}`);
  },
};
