import { useGetPermissionById, useUpdatePermission } from "@blocks-idp/iam/hooks/use-permission";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { useMemo } from "react";
import { mapPermissionToFormValues, permissionFormSchemaType } from "../permission-form/utils";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { PermissionForm } from "../permission-form";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { PermissionRolesList } from "./permission-roles-list";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { cn } from "@/lib/utils";
type PermissionDetailsProps = {
  id: string;
};
const FormLOadingSkeleton = () => (
  <Card>
    <CardContent>
      <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index}>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-8 w-full mt-2" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);
export const PermissionDetails = ({ id }: PermissionDetailsProps) => {
  const { data: permissionData, isLoading } = useGetPermissionById({ id });
  const { isPending, mutateAsync } = useUpdatePermission({ id });
  const formValues = useMemo(() => {
    if (!permissionData?.data) return null;
    return mapPermissionToFormValues(permissionData.data);
  }, [permissionData]);
  const onSubmit = async (formData: permissionFormSchemaType) => {
    try {
      const res = await mutateAsync({
        ...formData,
        type: +formData.type,
        isBuiltIn: permissionData?.data.isBuiltIn ?? false,
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
  BREADCRUMB_CUSTOM_TITLES[`/app/idp/permission-detail/${id}`] = id;
  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb breadcrumbIndex={4} />
      </div>
      <div className="mt-4 text-xl font-semibold flex items-center gap-2">
        {permissionData?.data.name || ""}
        {permissionData?.data && (
          <Badge
            className={cn(permissionData?.data.isBuiltIn ? "!bg-gray-300 !text-gray-800" : "!bg-purple-100 !text-purple-700")}
          >
            {permissionData?.data.isBuiltIn ? "Built In" : "Custom"}
          </Badge>
        )}
      </div>
      <div className="mt-4">
        {isLoading ? (
          <FormLOadingSkeleton />
        ) : (
          <PermissionForm
            onSave={onSubmit}
            isPending={isPending}
            values={formValues}
            isBuiltIn={permissionData?.data.isBuiltIn}
          />
        )}
      </div>
      {/* temporary solutions */}
      <PermissionRolesList slugs={permissionData?.data.roles || []} />
    </div>
  );
};
