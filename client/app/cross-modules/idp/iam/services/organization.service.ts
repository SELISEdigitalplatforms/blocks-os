import { http } from "@/lib/http/http-client";
import {
  ICreateOrUpdateOrganizationPayload,
  ICreateOrUpdateOrganizationResponse,
  IGetOrganizationByIdParams,
  IGetOrganizationByIdResponse,
  IGetOrganizationsParams,
  IGetOrganizationsResponse,
  IUpdateOrganizationPayload,
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
    payload.allowOrgCreationFromCloud ?? payload.allowCreationFromCloud ?? false,
  allowOrgCreationFromConstruct:
    payload.allowOrgCreationFromConstruct ?? payload.allowCreationFromConstruct ?? false,
  allowOrgCreationFromSignup: payload.allowOrgCreationFromSignup ?? false,
  allowOrgCreationFromPortal: payload.allowOrgCreationFromPortal ?? false,
  isMultiOrgEnabled: payload.isMultiOrgEnabled,
  consentForMultiOrgEnable: payload.consentForMultiOrgEnable,
  defaultRolesOnOrgCreation: payload.defaultRolesOnOrgCreation ?? payload.roles ?? [],
  defaultPermissionsOnOrgCreation: payload.defaultPermissionsOnOrgCreation ?? [],
  keepOrgRolesSameAsDefaultRoles: payload.keepOrgRolesSameAsDefaultRoles ?? true,
  keepOrgPermissionsSameAsDefaultPermissions:
    payload.keepOrgPermissionsSameAsDefaultPermissions ?? true,
});

export class OrganizationService {
  // The list endpoint binds a BaseGetsRequest: Page/PageSize at the root and the
  // free-text term under Filter.Search. Project scoping comes from the
  // X-Blocks-Key header, so projectKey is not a query parameter here.
  getOrganizations(params: IGetOrganizationsParams): Promise<IGetOrganizationsResponse> {
    const query = new URLSearchParams({
      Page: String(params.page),
      PageSize: String(params.pageSize),
    });
    if (params.searchText) query.set("Filter.Search", params.searchText);
    if (params.sort) {
      query.set("Sort.Property", params.sort.property);
      query.set("Sort.IsDescending", String(params.sort.isDescending));
    }
    return http.get(`${ORGANIZATION_ENDPOINTS.GET_ORGANIZATIONS}?${query.toString()}`, undefined, {
      absoluteUrl: true,
    });
  }

  getOrganizationById(params: IGetOrganizationByIdParams): Promise<IGetOrganizationByIdResponse> {
    return http.get(
      `${ORGANIZATION_ENDPOINTS.GET_ORGANIZATION}/${params.itemId}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  // Creation has its own route; POSTing the collection root is a 405 because
  // /organizations only serves GET.
  saveOrganization = (
    payload: ICreateOrUpdateOrganizationPayload,
  ): Promise<ICreateOrUpdateOrganizationResponse> => {
    return http.post(ORGANIZATION_ENDPOINTS.CREATE_ORGANIZATION, payload, undefined, {
      absoluteUrl: true,
    });
  };

  // The API exposes the update as a POST to the organizations collection with the item id
  // appended, which is the same base path SAVE_ORGANIZATION points at.
  updateOrganization = (
    payload: IUpdateOrganizationPayload,
  ): Promise<ICreateOrUpdateOrganizationResponse> => {
    return http.post(
      `${ORGANIZATION_ENDPOINTS.SAVE_ORGANIZATION}/${payload.itemId}`,
      { name: payload.name, isEnable: payload.isEnable },
      undefined,
      { absoluteUrl: true },
    );
  };

  getOrganizationConfig(_projectKey?: string): Promise<IOrganizationConfigResponse | null> {
    return http
      .get(ORGANIZATION_ENDPOINTS.GET_ORGANIZATION_CONFIG, undefined, {
        absoluteUrl: true,
      })
      .then((response) => mapOrganizationConfigFromApi(response as Record<string, unknown>));
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
