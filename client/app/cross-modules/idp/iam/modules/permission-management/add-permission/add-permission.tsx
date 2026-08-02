import { CreatePermissionPayload } from "@blocks-idp/iam/models/permission";
import { useAddPermission } from "@blocks-idp/iam/hooks/use-permission";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { PermissionForm } from "../permission-form";
import { permissionFormSchemaType } from "../permission-form/utils";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";

const BREADCRUMB_TITLES = {
  "/app/iam/permission-detail/new": "New",
};

export const AddPermission = () => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { isPending, mutateAsync } = useAddPermission();
  const onSubmit = async (data: permissionFormSchemaType) => {
    // None is a valid severity (0), so only an unset value counts as missing.
    if (data.permissionSeverity === undefined || data.permissionSeverity === null) {
      showErrorToast({ errors: "Severity is required" });
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
      showSuccessToast({ description: "Permission created successfully" });
      navigate(scoped(`iam/permissions`));
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };
  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb breadcrumbIndex={4} customTitles={BREADCRUMB_TITLES} />
      </div>
      <div className="mt-4 text-xl font-semibold">New Permission</div>
      <div className="mt-4">
        <PermissionForm onSave={onSubmit} isPending={isPending} />
      </div>
    </div>
  );
};
