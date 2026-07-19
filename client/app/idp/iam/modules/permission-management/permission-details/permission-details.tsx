import { useGetPermissionById, useUpdatePermission } from "@blocks-idp/iam/hooks/use-permission";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { useMemo } from "react";
import { mapPermissionToFormValues, permissionFormSchemaType } from "../permission-form/utils";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { PermissionForm } from "../permission-form";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
// import { PermissionRolesList } from "./permission-roles-list";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { cn } from "@/lib/utils";

type PermissionDetailsProps = {
  id: string;
};

const PermissionDetailsPageSkeleton = () => (
  <div>
    <div className="mb-4 flex min-w-0 items-center gap-2 sm:mb-6">
      <Skeleton className="h-7 w-56 sm:h-8 sm:w-72" />
      <Skeleton className="h-6 w-16 shrink-0 rounded-sm" />
    </div>
    <Card>
      <CardContent>
        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index}>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-2 h-8 w-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

export const PermissionDetails = ({ id }: PermissionDetailsProps) => {
  const { data: permissionData, isLoading } = useGetPermissionById({ id });
  const { isPending, mutateAsync } = useUpdatePermission({ id });
  const permission = permissionData?.data;
  const formValues = useMemo(() => {
    if (!permission) return null;
    return mapPermissionToFormValues(permission);
  }, [permission]);

  const onSubmit = async (formData: permissionFormSchemaType) => {
    if (permission?.isBuiltIn) return;
    try {
      const res = await mutateAsync({
        ...formData,
        type: +formData.type,
        isBuiltIn: permission?.isBuiltIn ?? false,
        dependentPermissions: +formData.type === 2 ? formData.dependentPermissions : [],
        itemId: id,
      });
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({ description: "Permission Updated successfully" });
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  if (isLoading || !permission?.name) {
    return <PermissionDetailsPageSkeleton />;
  }

  BREADCRUMB_CUSTOM_TITLES[`/app/idp/permission-detail/${id}`] = permission.name;

  return (
    <div>
      <div className="mb-4 flex min-w-0 items-center gap-2 sm:mb-6">
        <PageBreadcrumb
          breadcrumbIndex={4}
          className="flex min-w-0"
          listClassName="text-base sm:text-lg"
        />
        <Badge
          className={cn(
            "shrink-0",
            permission.isBuiltIn
              ? "!bg-gray-300 !text-gray-800"
              : "!bg-purple-100 !text-purple-700",
          )}
        >
          {permission.isBuiltIn ? "Built In" : "Custom"}
        </Badge>
      </div>
      <PermissionForm
        onSave={onSubmit}
        isPending={isPending}
        values={formValues}
        isBuiltIn={permission.isBuiltIn}
        showTags={false}
      />
      {/* <PermissionRolesList slugs={permission.roles || []} /> */}
    </div>
  );
};
