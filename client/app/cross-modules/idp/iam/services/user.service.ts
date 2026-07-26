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
  IGetSignUpSettingPayload,
  IGetSignUpSettingResponse,
  ISaveSignUpSettingPayload,
  ISaveSignUpSettingResponse,
} from "@blocks-idp/iam/models/user";
import { UserAccountService } from "./account.service";
import { USER_ENDPOINTS } from "../constants/endpoint.constant";
import { mapSignUpSettingFromApi } from "../utils/normalize-tenant-config";
import { toSignupSettingsSaveApiPayload } from "../utils/signup-settings-payload";
import { UserDetails } from "@seliseblocks/blocks-kit";

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
    return http.get(`${USER_ENDPOINTS.GET_USERS}/${payload.id}`, undefined, {
      absoluteUrl: true,
    });
  }

  addUser(createPayload: ICreateUserPayload): Promise<ICreateUserResponse> {
    return http.post(USER_ENDPOINTS.CREATE, createPayload, undefined, {
      absoluteUrl: true,
    });
  }

  updateUser(payload: IUpdateUserPayload): Promise<IUpdateUserResponse> {
    const flattenRecord = (value: unknown): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value as string[];
      return Object.values(value as Record<string, string[]>).flat();
    };
    const normalized = {
      itemId: payload.itemId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      userName: payload.userName,
      language: payload.language,
      organizationIds: payload.organizationIds,
      roles: flattenRecord(payload.roles),
      permissions: flattenRecord(payload.permissions),
      active: payload.active,
      status: payload.status,
      isVerified: payload.isVerified,
      mfaEnabled: payload.mfaEnabled,
      isMfaVerified: payload.isMfaVerified,
      userMfaType: payload.userMfaType,
      provisioningSource: payload.provisioningSource,
      externalIdentities: payload.externalIdentities,
      userCreationType: payload.userCreationType,
      isMultiOrgEnabled: payload.isMultiOrgEnabled,
      organizations: payload.organizations,
      profileImageId: payload.profileImageId,
      profileImageUrl: payload.profileImageUrl,
    };
    return http.post(`${USER_ENDPOINTS.GET_USERS}/${payload.itemId}`, normalized, undefined, {
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

  getUserRoles(payload: IGetUserRolesPayload): Promise<IGetUserRolesResponse> {
    return http.get(`${USER_ENDPOINTS.GET_USER_ROLES}?Id=${payload.userId}`, undefined, {
      absoluteUrl: true,
    });
  }

  getUserPermissions(payload: IGetUserPermissionsPayload): Promise<IGetUserPermissionsResponse> {
    return http.get(`${USER_ENDPOINTS.GET_USER_PERMISSIONS}?Id=${payload.userId}`, undefined, {
      absoluteUrl: true,
    });
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
