import { http } from "@/lib/http-client";
import { IAPIResponse } from "@/models/api-response";
import {
  CreatePermissionPayload,
  CreatePermissionResponse,
  IGetPermissionByIdPayload,
  IGetPermissionByIdResponse,
  IGetPermissionsPayload,
  IGetPermissionsSeverityRequestPayload,
  IGetPermissionsSeverityResponse,
  IGetResourceGroupPayload,
  IGetResourceGroupResponse,
  IPermission,
  UpdatePermissionPayload,
  UpdatePermissionResponse,
} from "@blocks-idp/iam/models/permission";
import { PERMISSION_ENDPOINTS } from "../constants/endpoint.constant";

export class PermissionService {
  getPermissions(
    payload: IGetPermissionsPayload,
  ): Promise<IAPIResponse<IPermission[]> & { totalCount: number }> {
    return http.post(PERMISSION_ENDPOINTS.GET_PERMISSIONS, payload, undefined, { absoluteUrl: true });
  }

  getPermissionsSeverity(
    payload: IGetPermissionsSeverityRequestPayload,
  ): Promise<IGetPermissionsSeverityResponse> {
    return http.get(
      `${PERMISSION_ENDPOINTS.GET_PERMISSIONS_GROUP_BY_SEVERITY}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  getPermissionById(payload: IGetPermissionByIdPayload): Promise<IGetPermissionByIdResponse> {
    return http.get(
      `${PERMISSION_ENDPOINTS.GET_PERMISSIONS}/${payload.id}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  addPermission = (
    addPermissionPayload: CreatePermissionPayload,
  ): Promise<CreatePermissionResponse> => {
    return http.post(PERMISSION_ENDPOINTS.CREATE_PERMISSION, addPermissionPayload, undefined, { absoluteUrl: true });
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
    return http.get(`${PERMISSION_ENDPOINTS.GET_RESOURCE_GROUPS}?ProjectKey=${payload.projectKey}`, undefined, { absoluteUrl: true });
  }
}

export const permissionService = new PermissionService();
