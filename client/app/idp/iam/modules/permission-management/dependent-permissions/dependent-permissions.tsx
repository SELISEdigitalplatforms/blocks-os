import { AddDependentPermission } from "./add-dependent-permission";
import { Badge } from "@/components/ui-kits/badge/badge";
import { X } from "lucide-react";

const MAX_DEPENDENT_PERMISSIONS = 5;

type DependentPermissionsProps = {
  permissionsResource: string[];
  onChange: (data: string[]) => void;
  disabled?: boolean;
};

export function DependentPermissions({
  permissionsResource,
  onChange,
  disabled = false,
}: DependentPermissionsProps) {
  const selectedCount = permissionsResource.length;

  const onRemoveHandler = (permission: string) => {
    onChange(permissionsResource.filter((item) => item !== permission));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            Dependent permissions (Max {MAX_DEPENDENT_PERMISSIONS})
          </span>
          <Badge
            variant="secondary"
            aria-label={`${selectedCount} of ${MAX_DEPENDENT_PERMISSIONS} permissions selected`}
          >
            {selectedCount}/{MAX_DEPENDENT_PERMISSIONS} selected
          </Badge>
        </div>
        {!disabled ? (
          <div className="shrink-0 self-start sm:self-center">
            <AddDependentPermission onChange={onChange} permissionsResource={permissionsResource} />
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        When this FE action is granted to a role, these permissions are included automatically.
      </p>
      <div className="flex min-h-10 w-full flex-wrap items-center gap-2 rounded-sm border p-2">
        {selectedCount > 0 ? (
          permissionsResource.map((item) => (
            <Badge variant="outline" className="max-w-full w-fit break-all" key={item}>
              {item}
              {!disabled ? (
                <X
                  className="ml-2 aspect-square w-3 shrink-0 cursor-pointer"
                  onClick={() => onRemoveHandler(item)}
                  aria-label={`Remove ${item}`}
                />
              ) : null}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">No dependent permissions selected</span>
        )}
      </div>
    </div>
  );
}
