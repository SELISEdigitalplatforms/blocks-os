import { useT } from "@seliseblocks/genesis-os";
import { CreatePermissionPayload } from "@blocks-idp/iam/models/permission";
import { useAddPermission } from "@blocks-idp/iam/hooks/use-permission";
import { useSystemOnlyReason } from "@blocks-idp/iam/hooks/use-grant-scope";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { PermissionForm } from "../permission-form";
import { PermissionFormSchemaType } from "../permission-form/utils";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";

export const AddPermission = () => {
  const { t } = useT("os.idp.permissions");
  const breadcrumbTitles = useMemo(
    () => ({ "/app/iam/permission-detail/new": t("ADD_PERMISSION.BREADCRUMB_NEW") }),
    [t],
  );
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { isPending, mutateAsync } = useAddPermission();
  const readOnlyReason = useSystemOnlyReason();
  const onSubmit = async (data: PermissionFormSchemaType) => {
    if (readOnlyReason) return;
    // None is a valid severity (0), so only an unset value counts as missing.
    if (data.permissionSeverity === undefined || data.permissionSeverity === null) {
      showErrorToast({ errors: t("ADD_PERMISSION.SEVERITY_REQUIRED") });
      return;
    }
    try {
      const newPermission: CreatePermissionPayload = {
        ...data,
        type: +data.type,
        isBuiltIn: false,
        permissionSeverity: data.permissionSeverity,
        dependentPermissions: +data.type === 2 ? data.dependentPermissions : [],
      };
      const res = await mutateAsync(newPermission);
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({ description: t("ADD_PERMISSION.CREATED_SUCCESS") });
      navigate(scoped(`iam/permissions`));
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: t("ADD_PERMISSION.SOMETHING_WENT_WRONG") });
    }
  };
  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb breadcrumbIndex={4} customTitles={breadcrumbTitles} />
      </div>
      <div className="mt-4 text-xl font-semibold">{t("ADD_PERMISSION.TITLE")}</div>
      <div className="mt-4">
        <PermissionForm onSave={onSubmit} isPending={isPending} readOnlyReason={readOnlyReason} />
      </div>
    </div>
  );
};
