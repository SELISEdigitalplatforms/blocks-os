import { http } from "@/lib/http/http-client";
import {
  ICreateOrUpdateOrganizationPayload,
  ICreateOrUpdateOrganizationResponse,
  IGetOrganizationByIdParams,
  IGetOrganizationByIdResponse,
  IGetOrganizationsParams,
  IGetOrganizationsResponse,
} from "@blocks-idp/iam/models/organization";
import {
  IOrganizationConfigPayload,
  IOrganizationConfigResponse,
  IOrganizationConfigSaveApiPayload,
  IOrganizationConfigSaveResponse,
} from "@blocks-idp/iam/models/organization-config.model";
import { ORGANIZATION_ENDPOINTS } from "../constants/endpoint.constant";
import { toOrganizationConfigSaveApiPayload } from "../utils/organization-config-payload";
import { mapOrganizationConfigFromApi } from "../utils/normalize-tenant-config";

const toSaveApiPayload = (
  payload: IOrganizationConfigPayload,
): IOrganizationConfigSaveApiPayload => ({
  allowOrgCreationFromCloud:
    payload.allowOrgCreationFromCloud ??
    payload.allowCreationFromCloud ??
    false,
  allowOrgCreationFromConstruct:
    payload.allowOrgCreationFromConstruct ??
    payload.allowCreationFromConstruct ??
    false,
  allowOrgCreationFromSignup: payload.allowOrgCreationFromSignup ?? false,
  allowOrgCreationFromPortal: payload.allowOrgCreationFromPortal ?? false,
  isMultiOrgEnabled: payload.isMultiOrgEnabled,
  consentForMultiOrgEnable: payload.consentForMultiOrgEnable,
  defaultRolesOnOrgCreation:
    payload.defaultRolesOnOrgCreation ?? payload.roles ?? [],
  defaultPermissionsOnOrgCreation:
    payload.defaultPermissionsOnOrgCreation ?? [],
  keepOrgRolesSameAsDefaultRoles:
    payload.keepOrgRolesSameAsDefaultRoles ?? true,
  keepOrgPermissionsSameAsDefaultPermissions:
    payload.keepOrgPermissionsSameAsDefaultPermissions ?? true,
});

export class OrganizationService {
  getOrganizations(
    params: IGetOrganizationsParams,
  ): Promise<IGetOrganizationsResponse> {
    let url = `${ORGANIZATION_ENDPOINTS.GET_ORGANIZATIONS}?projectKey=${params.projectKey}&page=${params.page}&pageSize=${params.pageSize}`;
    params.searchText ? (url += `&SearchText=${params.searchText}`) : null;
    return http.get(url, undefined, { absoluteUrl: true });
  }

  getOrganizationById(
    params: IGetOrganizationByIdParams,
  ): Promise<IGetOrganizationByIdResponse> {
    return http.get(
      `${ORGANIZATION_ENDPOINTS.GET_ORGANIZATION}?ProjectKey=${params.projectKey}&ItemId=${params.itemId}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  saveOrganization = (
    payload: ICreateOrUpdateOrganizationPayload,
  ): Promise<ICreateOrUpdateOrganizationResponse> => {
    return http.post(
      ORGANIZATION_ENDPOINTS.SAVE_ORGANIZATION,
      payload,
      undefined,
      { absoluteUrl: true },
    );
  };

  getOrganizationConfig(
    _projectKey?: string,
  ): Promise<IOrganizationConfigResponse | null> {
    return http
      .get(ORGANIZATION_ENDPOINTS.GET_ORGANIZATION_CONFIG, undefined, {
        absoluteUrl: true,
      })
      .then((response) =>
        mapOrganizationConfigFromApi(response as Record<string, unknown>),
      );
  }

  saveOrganizationConfig = (
    payload: IOrganizationConfigPayload,
  ): Promise<IOrganizationConfigSaveResponse> => {
    return http.post(
      ORGANIZATION_ENDPOINTS.SAVE_ORGANIZATION_CONFIG,
      toOrganizationConfigSaveApiPayload(toSaveApiPayload(payload)),
      undefined,
      { absoluteUrl: true },
    );
  };
}

export const organizationService = new OrganizationService();
