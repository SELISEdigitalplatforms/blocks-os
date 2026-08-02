import { http } from "@/lib/http/http-client";
import { parseMongoDBString } from "@/lib/utils";
import {
  IAccountResendActivationPayload,
  IAccountResendActivationResponse,
  ICreateUserPayload,
  ICreateUserResponse,
  IDeviceSessionResponse,
  IGeneratePATPayload,
  IGetHistoriesPayload,
  IGetSessionPayload,
  IGetUserByIdPayload,
  IGetUserByIdResponse,
  IGetUserPermissionsPayload,
  IGetUserPermissionsResponse,
  IGetUserRolesPayload,
  IGetUserRolesResponse,
  IGetUsersPayload,
  IGetUsersResponse,
  IHistoriesResponse,
  IPATResponse,
  ISaveRolesAndPermissionsPayload,
  ISaveRolesAndPermissionsResponse,
  IUpdateUserPayload,
  IUpdateUserResponse,
  IUpdateUserAccessControlPayload,
  IUpdateUserAccessControlResponse,
  IRevokeAccessPayload,
  IRevokeAccessResponse,
  User,
  IGetSignUpSettingPayload,
  IGetSignUpSettingResponse,
  ISaveSignUpSettingPayload,
  ISaveSignUpSettingResponse,
} from "@blocks-idp/iam/models/user";
import { UserAccountService } from "./account.service";
import { PERMISSION_ENDPOINTS, ROLE_ENDPOINTS, USER_ENDPOINTS } from "../constants/endpoint.constant";
import { mapSignUpSettingFromApi } from "../utils/normalize-tenant-config";
import { toSignupSettingsSaveApiPayload } from "../utils/signup-settings-payload";
import { UserDetails } from "@seliseblocks/genesis-os";

type ApiUser = User & { OrganizationIds?: string[] };

const toScopedRecord = (
  organizationIds: string[],
  value: Record<string, string[]> | string[] | undefined,
): Record<string, string[]> => {
  if (!value) return {};
  if (!Array.isArray(value)) return { ...value };
  if (organizationIds.length === 0) return {};
  return Object.fromEntries(organizationIds.map((orgId) => [orgId, [...value]]));
};

// Roles and permissions are stored per organization, so the same slug can appear
// under several keys. Flatten to the distinct set the lookup endpoints expect.
const uniqueScopedValues = (scoped: Record<string, string[]> | undefined): string[] => [
  ...new Set(Object.values(scoped ?? {}).flat()),
];

const normalizeUserFromApi = (raw: ApiUser): User => {
  const organizationIds =
    raw.organizationIds?.length > 0 ? raw.organizationIds : (raw.OrganizationIds ?? []);

  const roles = toScopedRecord(
    organizationIds,
    raw.roles as Record<string, string[]> | string[] | undefined,
  );
  const permissions = toScopedRecord(
    organizationIds,
    raw.permissions as Record<string, string[]> | string[] | undefined,
  );

  return {
    ...raw,
    organizationIds,
    roles,
    permissions,
    OrganizationsRoles: raw.OrganizationsRoles ?? roles,
    OrganizationsPermissions: raw.OrganizationsPermissions ?? permissions,
  };
};

export class UserService {
  constructor(public account: UserAccountService) {}

  getUsers(payload: IGetUsersPayload): Promise<IGetUsersResponse> {
    return http.post(USER_ENDPOINTS.GET_USERS, payload, undefined, {
      absoluteUrl: true,
    });
  }

  getUser(): Promise<{ data: UserDetails }> {
    return http.get(`${USER_ENDPOINTS.GET_USERS}`, undefined, {
      absoluteUrl: true,
    });
  }

  me(): Promise<{ data: UserDetails }> {
    return http.get(`${USER_ENDPOINTS.ME}`, undefined, {
      absoluteUrl: true,
    });
  }

  getUserInfo(): Promise<UserDetails> {
    return http.get(`${USER_ENDPOINTS.USER_INFO}`, undefined, {
      absoluteUrl: true,
    });
  }

  getUserById(payload: IGetUserByIdPayload): Promise<IGetUserByIdResponse> {
    return http
      .get<IGetUserByIdResponse>(`${USER_ENDPOINTS.GET_USERS}/${payload.id}`, undefined, {
        absoluteUrl: true,
      })
      .then((response) => ({
        ...response,
        data: normalizeUserFromApi(response.data as ApiUser),
      }));
  }

  addUser(createPayload: ICreateUserPayload): Promise<ICreateUserResponse> {
    return http.post(USER_ENDPOINTS.CREATE, createPayload, undefined, {
      absoluteUrl: true,
    });
  }

  isUserExist(email: string): Promise<{ userId?: string; organizationIds?: string[] }> {
    return http.get(`${USER_ENDPOINTS.EXISTS}?email=${encodeURIComponent(email)}`, undefined, {
      absoluteUrl: true,
    });
  }

  async updateUser(payload: IUpdateUserPayload): Promise<IUpdateUserResponse> {
    const current = await this.getUserById({ id: payload.itemId, projectKey: "" });
    const flattened = flattenRolesAndPermissions(current.data, payload);
    // The /users/{id} endpoint treats the body as a full record replacement,
    // omitting a field on the request wipes it on the server. Fetch the
    // latest server-side record and merge the requested changes on top so
    // unrelated fields (image, name, roles, MFA flags, etc.) survive the
    // update.
    const body = mergeUserUpdate(current.data, payload, flattened);
    return http.post(`${USER_ENDPOINTS.GET_USERS}/${payload.itemId}`, body, undefined, {
      absoluteUrl: true,
    });
  }

  async updateMe(payload: IUpdateUserPayload): Promise<IUpdateUserResponse> {
    const current = await this.me();
    const flattened = flattenRolesAndPermissions(current.data as unknown as User, payload);
    // /api/iam/me behaves the same as /api/iam/users/{id}, it overwrites
    // whatever fields aren't in the body. Read the current record, apply
    // the requested changes, and POST the merged record.
    const body = mergeUserUpdate(current.data as unknown as User, payload, flattened);
    return http.post(USER_ENDPOINTS.UPDATE_ME, body, undefined, {
      absoluteUrl: true,
    });
  }

  getSignUpSetting(_payload?: IGetSignUpSettingPayload): Promise<IGetSignUpSettingResponse> {
    return http
      .get(USER_ENDPOINTS.GET_SIGNUP_SETTING, undefined, { absoluteUrl: true })
      .then((response) => mapSignUpSettingFromApi(response as Record<string, unknown>));
  }

  saveSignUpSetting(payload: ISaveSignUpSettingPayload): Promise<ISaveSignUpSettingResponse> {
    return http.post(
      USER_ENDPOINTS.SAVE_SIGNUP_SETTING,
      toSignupSettingsSaveApiPayload(payload),
      undefined,
      { absoluteUrl: true },
    );
  }

  saveRolesAndPermissions(
    payload: ISaveRolesAndPermissionsPayload,
  ): Promise<ISaveRolesAndPermissionsResponse> {
    return http.post(USER_ENDPOINTS.SAVE_ROLES_AND_PERMISSIONS, payload, undefined, {
      absoluteUrl: true,
    });
  }

  updateUserAccessControl(
    payload: IUpdateUserAccessControlPayload,
  ): Promise<IUpdateUserAccessControlResponse> {
    return http.post(USER_ENDPOINTS.ACCESS_CONTROL, payload, undefined, {
      absoluteUrl: true,
    });
  }

  revokeAccess(payload: IRevokeAccessPayload): Promise<IRevokeAccessResponse> {
    return http.post(USER_ENDPOINTS.REVOKE_ACCESS, payload, undefined, {
      absoluteUrl: true,
    });
  }

  // There is no per-user roles endpoint. A user record carries role slugs (keyed
  // by organization), and the role list endpoint resolves those slugs to the full
  // records the roles table renders.
  async getUserRoles(payload: IGetUserRolesPayload): Promise<IGetUserRolesResponse> {
    const user = await this.getUserById({ id: payload.userId, projectKey: "" });
    const slugs = uniqueScopedValues(user.data?.roles);
    if (slugs.length === 0) return { data: [], totalCount: 0, errors: null };

    return http.post(
      ROLE_ENDPOINTS.GET_ROLES,
      { page: 0, pageSize: slugs.length, filter: { slugs } },
      undefined,
      { absoluteUrl: true },
    );
  }

  // Same shape as getUserRoles: the user record holds the granted resources and
  // the permission list endpoint expands them into full permission records.
  async getUserPermissions(
    payload: IGetUserPermissionsPayload,
  ): Promise<IGetUserPermissionsResponse> {
    const user = await this.getUserById({ id: payload.userId, projectKey: "" });
    const resources = uniqueScopedValues(user.data?.permissions);
    if (resources.length === 0) return { data: [], totalCount: 0, errors: null };

    return http.post(
      PERMISSION_ENDPOINTS.GET_PERMISSIONS,
      { page: 0, pageSize: resources.length, filter: { resources } },
      undefined,
      { absoluteUrl: true },
    );
  }

  accountDeactivate(
    payload: IAccountResendActivationPayload,
  ): Promise<IAccountResendActivationResponse> {
    return http.post(USER_ENDPOINTS.DEACTIVATE, payload, undefined, {
      absoluteUrl: true,
    });
  }

  async getSessions(payload: IGetSessionPayload): Promise<IDeviceSessionResponse> {
    const res = await http.get<{
      data: string[];
      errors: unknown;
      totalCount: number;
    }>(
      `${USER_ENDPOINTS.GET_SESSIONS}?page=${payload.page}&pageSize=${payload.pageSize}&projectkey=${payload.projectKey}&filter.userId=${payload.filter.UserId}`,
      undefined,
      { absoluteUrl: true },
    );
    return {
      data: res.data.map((item) => JSON.parse(parseMongoDBString(item))),
      totalCount: res.totalCount,
      errors: res.errors,
    };
  }

  async getHistories(payload: IGetHistoriesPayload): Promise<IHistoriesResponse> {
    const res = await http.get<{
      data: string[];
      errors: unknown;
      totalCount: number;
    }>(
      `${USER_ENDPOINTS.GET_HISTORIES}?page=${payload.page}&pageSize=${payload.pageSize}&projectkey=${payload.projectKey}&filter.userId=${payload.filter.UserId}`,
      undefined,
      { absoluteUrl: true },
    );
    return {
      data: res.data.map((item) => JSON.parse(parseMongoDBString(item))),
      totalCount: res.totalCount,
      errors: res.errors,
    };
  }

  async getPats(): Promise<IPATResponse> {
    return http.get(USER_ENDPOINTS.GET_USER_CODES, undefined, {
      absoluteUrl: true,
    });
  }

  async generatePats(payload: IGeneratePATPayload): Promise<IPATResponse> {
    return http.post(USER_ENDPOINTS.GENERATE_USER_CODE, payload, undefined, {
      absoluteUrl: true,
    });
  }
}

export const userService = new UserService(new UserAccountService());

type FlattenedRolesAndPermissions = {
  organizationIds?: string[];
  roles?: string[];
  permissions?: string[];
};

const flattenRolesAndPermissions = (
  current: User | undefined,
  payload: IUpdateUserPayload,
): FlattenedRolesAndPermissions => {
  const result: FlattenedRolesAndPermissions = {};
  const payloadHasRolesOrOrgs =
    payload.roles !== undefined ||
    payload.permissions !== undefined ||
    payload.organizations !== undefined ||
    payload.organizationIds !== undefined;

  if (!payloadHasRolesOrOrgs && !current) return result;

  const organizationIds =
    payload.organizationIds !== undefined
      ? payload.organizationIds
      : (current?.organizationIds ?? []);

  if (payload.organizationIds !== undefined) {
    result.organizationIds = payload.organizationIds;
  }

  if (payload.roles !== undefined) {
    result.roles = Array.isArray(payload.roles)
      ? payload.roles
      : Object.values(payload.roles as Record<string, string[]>).flat();
  } else if (current?.roles) {
    result.roles = Object.values(current.roles).flat();
  }

  if (payload.permissions !== undefined) {
    result.permissions = Array.isArray(payload.permissions)
      ? payload.permissions
      : Object.values(payload.permissions as Record<string, string[]>).flat();
  } else if (current?.permissions) {
    result.permissions = Object.values(current.permissions).flat();
  }

  if (payload.roles !== undefined || payload.permissions !== undefined) {
    result.organizationIds = organizationIds;
  }

  return result;
};

const mergeUserUpdate = (
  current: User,
  payload: IUpdateUserPayload,
  flattened: FlattenedRolesAndPermissions,
): Record<string, unknown> => {
  // Send every known field of the current record so the server doesn't
  // wipe untouched ones (profileImage, name, MFA flags, etc.). The fields
  // in `payload` (and the flattened role/permission forms) override.
  const body: Record<string, unknown> = {
    ...current,
    itemId: payload.itemId,
  };
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) body[key] = value;
  }
  if (flattened.organizationIds !== undefined) {
    body.organizationIds = flattened.organizationIds;
  }
  if (flattened.roles !== undefined) body.roles = flattened.roles;
  if (flattened.permissions !== undefined) body.permissions = flattened.permissions;
  return body;
};
