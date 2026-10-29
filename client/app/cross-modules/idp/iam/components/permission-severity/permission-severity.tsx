import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { cn } from "@/lib/utils";
import {
  IGetPermissionsSeverityResponse,
  PERMISSION_SEVERITY_OPTIONS,
} from "@blocks-idp/iam/models/permission";
import { useMemo } from "react";
type PermissionSeverityProps = {
  data: IGetPermissionsSeverityResponse;
  isLoading: boolean;
};
export const PermissionSeverity = ({ data, isLoading }: PermissionSeverityProps) => {
  const severityData = useMemo(() => {
    if (!data) return [];
    return PERMISSION_SEVERITY_OPTIONS.map((option) => {
      const count = data.find((item) => item.severityLevel === option.id)?.count || 0;
      return {
        ...option,
        count,
      };
    });
  }, [data]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Permission Severity Overview</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {severityData.map((item) => (
            <div
              key={item.value}
              className={cn("relative min-w-0 overflow-hidden px-3 py-2.5", item.className)}
            >
              <div className={cn(item.barClassName, "absolute left-0 top-0 h-full w-1.5")} />
              <div className="min-w-0 pl-2">
                <p className="truncate text-xs font-semibold uppercase">{item.label} Risk</p>
                {isLoading ? (
                  <Skeleton className="mt-2 h-6 w-[100px]" />
                ) : (
                  <div className="mt-1.5 flex items-end gap-1.5">
                    <span className="text-2xl font-extrabold leading-none text-foreground">
                      {String(item.count).padStart(2, "0")}
                    </span>
                    <span className="truncate pb-0.5 text-xs font-medium text-foreground">
                      Permissions
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
