import { http } from "@/lib/http/http-client";
import { IAPIResponse } from "@/models/api-response";
import { IPermissionArchiveImpact } from "@blocks-idp/iam/models/archive-impact.model";
import {
  CreatePermissionPayload,
  CreatePermissionResponse,
  IGetPermissionByIdPayload,
  IGetPermissionByIdResponse,
  IGetPermissionsPayload,
  IGetPermissionsSeverityResponse,
  IGetResourceGroupPayload,
  IGetResourceGroupResponse,
  IPermission,
  UpdatePermissionPayload,
  UpdatePermissionResponse,
} from "@blocks-idp/iam/models/permission";
import { PERMISSION_ENDPOINTS } from "../constants/endpoint.constant";
import { ArchiveResponse } from "../constants/archive-error-messages";

export class PermissionService {
  getPermissions(
    payload: IGetPermissionsPayload,
  ): Promise<IAPIResponse<IPermission[]> & { totalCount: number }> {
    return http.post(PERMISSION_ENDPOINTS.GET_PERMISSIONS, payload, undefined, {
      absoluteUrl: true,
    });
  }

  // The endpoint takes no parameters; nothing from the caller is sent. Project scoping happens
  // via the X-Blocks-Key header, and the hook gates the request on a selected project.
  getPermissionsSeverity(): Promise<IGetPermissionsSeverityResponse> {
    return http.get(`${PERMISSION_ENDPOINTS.GET_PERMISSIONS_GROUP_BY_SEVERITY}`, undefined, {
      absoluteUrl: true,
    });
  }

  /**
   * Archives a permission. Soft delete on the backend. Note the caller must be in the default
   * organization for this to succeed -- there is no client-side signal for that, so the rejection
   * is surfaced as a mapped toast rather than the action being hidden.
   */
  deletePermission(id: string, confirmRevokeFromUsers = false): Promise<ArchiveResponse> {
    const query = confirmRevokeFromUsers ? "?confirmRevokeFromUsers=true" : "";
    return http.delete(`${PERMISSION_ENDPOINTS.GET_PERMISSIONS}/${id}${query}`, undefined, {
      absoluteUrl: true,
    });
  }

  /**
   * What archiving this permission would affect. Reports direct per-user grants and role
   * references separately -- they are different populations and only the first grants access.
   */
  getPermissionArchiveImpact(id: string): Promise<IPermissionArchiveImpact> {
    return http.get(`${PERMISSION_ENDPOINTS.GET_PERMISSIONS}/${id}/archive-impact`, undefined, {
      absoluteUrl: true,
    });
  }

  getPermissionById(payload: IGetPermissionByIdPayload): Promise<IGetPermissionByIdResponse> {
    return http.get(`${PERMISSION_ENDPOINTS.GET_PERMISSIONS}/${payload.id}`, undefined, {
      absoluteUrl: true,
    });
  }

  addPermission = (
    addPermissionPayload: CreatePermissionPayload,
  ): Promise<CreatePermissionResponse> => {
    return http.post(PERMISSION_ENDPOINTS.CREATE_PERMISSION, addPermissionPayload, undefined, {
      absoluteUrl: true,
    });
  };

  updatePermission = (payload: UpdatePermissionPayload): Promise<UpdatePermissionResponse> => {
    return http.post(
      `${PERMISSION_ENDPOINTS.GET_PERMISSIONS}/${payload.itemId}`,
      payload,
      undefined,
      { absoluteUrl: true },
    );
  };

  getResourceGroup(payload: IGetResourceGroupPayload): Promise<IGetResourceGroupResponse> {
    return http.get(
      `${PERMISSION_ENDPOINTS.GET_RESOURCE_GROUPS}?ProjectKey=${payload.projectKey}`,
      undefined,
      { absoluteUrl: true },
    );
  }
}

export const permissionService = new PermissionService();
