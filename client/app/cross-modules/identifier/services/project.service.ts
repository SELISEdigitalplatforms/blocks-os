import { http } from "@/lib/http/http-client";
import { IValidateCnameProjectPayload } from "@/models/project.model";
import {
  CLOUD_BUILD_ENDPOINTS,
  DOMAIN_ENDPOINTS,
  MIGRATION_ENDPOINTS,
  PROJECT_ENDPOINTS,
  SUBSCRIPTION_ENDPOINTS,
} from "@blocks-identifier/constants/endpoint.constant";
import {
  ICreateProjectPayload,
  IDisableProjectPayload,
  IDisableProjectResponse,
  AssetMutationStatus,
  IEnvRepository,
  IGetProjectResponse,
  IGetPublicCertificateResponse,
  IGetSubscriptionUsageResponse,
  IMigrationInitiateResponse,
  IMigrationRequest,
  IMigrationStatusResponse,
  IMigrationVerificationResponse,
  IProjectGroup,
  IResource,
  ISavePublicCertificatePayload,
  IUpdateProjectPayload,
  IUpdateProjectResponse,
  IUpdateTenantGroupPayload,
  IValidateCNameProjectResponse,
  IVerifyMigrationRequest,
} from "@blocks-identifier/models/project.model";
import {
  JwtClaimPayload,
  JwtClaimResponse,
} from "@blocks-idp/authentication/models/jwt.claim.model";

export class ProjectService {
  getProjects(page: number, pageSize: number, tenantGroupId: string): Promise<IProjectGroup[]> {
    const url = `${PROJECT_ENDPOINTS.GETS}?page=${page}&pageSize=${pageSize}&tenantGroupId=${tenantGroupId}`;
    return http.get(url);
  }

  // The endpoint binds a BaseGetsRequest: Page/PageSize at the root and the free-text term
  // under Filter.Search, which matches either the repository name or its link. totalCount
  // counts the filtered set, not the page.
  getAssets(
    tenantGroupId: string,
    page: number = 0,
    pageSize: number = 12,
    search: string = "",
  ): Promise<{
    assets: {
      resources: IResource[];
      tenantGroupId: string;
      createdDate: string;
      itemId: string;
    };
    totalCount: number;
    errors: unknown | null;
    isSuccess: boolean;
  }> {
    const query = new URLSearchParams({
      TenantGroupId: tenantGroupId,
      Page: String(page),
      PageSize: String(pageSize),
    });
    if (search.trim()) query.set("Filter.Search", search.trim());

    return http.get(`${PROJECT_ENDPOINTS.GET_ASSET}?${query.toString()}`);
  }

  addAssets(payload: { tenantGroupId: string; resource: IResource }): Promise<{
    errors: unknown | null;
    isSuccess: boolean;
    status: AssetMutationStatus;
  }> {
    return http.post(PROJECT_ENDPOINTS.ADD_ASSET, payload);
  }

  // Archives the repository rather than erasing it, so adding the same one again restores it.
  deleteAsset(payload: { tenantGroupId: string; resourceId: string }): Promise<{
    errors: unknown | null;
    isSuccess: boolean;
  }> {
    return http.post(PROJECT_ENDPOINTS.DELETE_ASSET, payload);
  }

  getEnvRepositories(): Promise<{
    data: IEnvRepository[];
    errors: unknown | null;
    isSuccess: boolean;
  }> {
    const url = `${CLOUD_BUILD_ENDPOINTS.REPOS_LIST}`;
    return http.get(url, undefined, { absoluteUrl: true });
  }

  repoUpdate(payload: {
    projectKey: string;
    projectEnv: string;
    repoWithDomains: {
      repoId: string;
      repoUrl: string;
      customDeploymentDomain: string;
    }[];
  }): Promise<{
    errors: unknown | null;
    isSuccess: boolean;
  }> {
    return http.post(CLOUD_BUILD_ENDPOINTS.REPO_UPDATE, payload, undefined, {
      absoluteUrl: true,
    });
  }

  // Resolves the project from the caller's auth context — there is no
  // parameter to pass; the token's tenant selects the project.
  getProject(): Promise<IGetProjectResponse> {
    return http.get(PROJECT_ENDPOINTS.GET);
  }

  createProject(payload: ICreateProjectPayload): Promise<{
    isSuccess: boolean;
    errors: Record<string, string | string[]>;
    tenantGroupId: string;
  }> {
    return http.post(PROJECT_ENDPOINTS.CREATE, payload);
  }

  validateCNameProject(
    payload: IValidateCnameProjectPayload,
  ): Promise<IValidateCNameProjectResponse> {
    return http.post(DOMAIN_ENDPOINTS.CONFIGURE, payload);
  }

  updateProject(payload: IUpdateProjectPayload): Promise<IUpdateProjectResponse> {
    return http.post(PROJECT_ENDPOINTS.UPDATE_PROJECT, payload);
  }

  updateTenantGroup(payload: IUpdateTenantGroupPayload): Promise<IUpdateProjectResponse> {
    return http.post(PROJECT_ENDPOINTS.UPDATE_PROJECT_GROUP, payload);
  }
  disableProject(payload: IDisableProjectPayload): Promise<IDisableProjectResponse> {
    return http.post(PROJECT_ENDPOINTS.DISABLE, payload);
  }

  // Data Migration Methods
  initiateMigration(payload: IMigrationRequest): Promise<IMigrationInitiateResponse> {
    return http.post(MIGRATION_ENDPOINTS.MIGRATE, payload, undefined, { absoluteUrl: true });
  }

  verifyMigration(payload: IVerifyMigrationRequest): Promise<IMigrationVerificationResponse> {
    return http.post(MIGRATION_ENDPOINTS.VERIFY, payload, undefined, { absoluteUrl: true });
  }

  getMigrationStatus(tenantGroupId: string): Promise<IMigrationStatusResponse> {
    const url = `${MIGRATION_ENDPOINTS.GET_STATUS}?tenantGroupId=${tenantGroupId}`;
    return http.get(url, undefined, { absoluteUrl: true });
  }

  savePublicCertificate(payload: ISavePublicCertificatePayload): Promise<IUpdateProjectResponse> {
    return http.post(PROJECT_ENDPOINTS.UPDATE_TOKEN_VALIDATION, payload);
  }

  getPublicCertificateInformation(

  ): Promise<IGetPublicCertificateResponse | null> {
    const url = `${PROJECT_ENDPOINTS.GET_TOKEN_VALIDATION}`;
    return http.get<IGetPublicCertificateResponse | null>(url);
  }

  async validateJwksUrl(url: string): Promise<{
    isValid: boolean;
    error?: string;
    data?: unknown;
  }> {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        // invalid
        // HTTP error
        return {
          isValid: false,
          error: `Invalid, provide a valid jwks URL`,
        };
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.includes("application/json")) {
        // invalid
        // Response is not JSON
        return {
          isValid: false,
          error: "Invalid, provide a valid jwks URL",
        };
      }

      const json = await response.json();

      // Structure validation
      if (!json.keys || !Array.isArray(json.keys) || json.keys.length === 0) {
        // invalid
        // Missing or invalid 'keys' array in JWKS
        return {
          isValid: false,
          error: "Invalid, provide a valid jwks URL",
        };
      }

      return { isValid: true, data: json };
    } catch (error) {
      console.error("JWKS URL Validation Error:", error);
      return {
        isValid: false,
        error: "Invalid, provide a valid jwks URL",
      };
    }
  }

  getJwtClaim(): Promise<JwtClaimResponse> {
    return http.get(PROJECT_ENDPOINTS.GET_JWT_CLAIMS);
  }

  addJwtClaim(payload: JwtClaimPayload): Promise<{
    errors: unknown | null;
    isSuccess: boolean;
  }> {
    return http.post(PROJECT_ENDPOINTS.SAVE_JWT_CLAIMS, payload);
  }

  getSubscriptionUsage(projectKey: string): Promise<IGetSubscriptionUsageResponse> {
    return http.get(`${SUBSCRIPTION_ENDPOINTS.GETS}?projectKey=${projectKey}`);
  }
}

export const projectService = new ProjectService();
