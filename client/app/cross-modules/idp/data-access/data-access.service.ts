import { http } from "@/lib/http/http-client";
import type { ICreatePolicyPayload, ICreatePolicyResponse, IDeletePolicyResponse, IGetPolicyResponse, ISetDataAccessResponse, ISetRowColumnPermissionPayload, IUpdatePolicyPayload } from "./gateway/models/data-service";
import type { RequiredOn } from "./gateway/models/data-service";
import type { IFieldDefaultValue, IFieldValidationRule, IPlatformSchemaRules, ISchemaFieldValidation } from "./rules/rules.types";

export const PLATFORM_SERVICES = ["IAM", "OS", "Logic", "Release", "Monitor"] as const;
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
  /** When the property must be sent: None, Insert, Update or Both. */
  requiredOn?: RequiredOn;
  readAccessLevel?: number;
  writeAccessLevel?: number;
  editAccessLevel: number;
  deleteAccessLevel?: number;
  /** The property's validation rules; present only while rules are switched on. */
  validationRule?: IFieldValidationRule | null;
  /** Filled in on insert when the property is null. */
  defaultValue?: IFieldDefaultValue | null;
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
  /** Which properties take validation rules and defaults; null while rules are off or when the schema takes none. */
  rules?: IPlatformSchemaRules | null;
};

export type SavePlatformValidationPayload = { schemaId: string; fieldName: string; validations: ISchemaFieldValidation[] };
export type SetPlatformFieldDefaultPayload = { schemaId: string; fieldName: string; defaultValue: IFieldDefaultValue | null };
type Ack = Response<{ acknowledged: boolean; itemId?: string }>;

type Response<T> = { isSuccess: boolean; data: T; errors?: unknown; message?: string };

export const platformDataAccessService = {
  getSchemas: () => http.get<Response<PlatformSchema[]>>("/api/PlatformDataAccess/Schemas"),
  getPolicies: (schemaId: string) => http.get<IGetPolicyResponse>(`/api/PlatformDataAccess/Policies?schemaId=${encodeURIComponent(schemaId)}`),
  configure: (payload: ISetRowColumnPermissionPayload) => http.post<ISetDataAccessResponse>("/api/PlatformDataAccess/Configure", payload),
  create: (payload: ICreatePolicyPayload) => http.post<ICreatePolicyResponse>("/api/PlatformDataAccess/Create", payload),
  update: (payload: IUpdatePolicyPayload) => http.post<ICreatePolicyResponse>("/api/PlatformDataAccess/Update", payload),
  delete: (itemId: string) => http.delete<IDeletePolicyResponse>(`/api/PlatformDataAccess/Delete?itemId=${encodeURIComponent(itemId)}`),
  /** Replaces a property's validation rules; an empty list removes them. */
  saveValidation: (payload: SavePlatformValidationPayload) => http.post<Ack>("/api/PlatformDataAccess/SaveValidation", payload),
  /** Sets or (null) clears a property's default value. */
  setFieldDefault: (payload: SetPlatformFieldDefaultPayload) => http.post<Ack>("/api/PlatformDataAccess/FieldDefault", payload),
};
