import { useT } from "@seliseblocks/genesis-os";
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
  const { t } = useT("os.idp.permissions");
  const selectedCount = permissionsResource.length;

  const onRemoveHandler = (permission: string) => {
    onChange(permissionsResource.filter((item) => item !== permission));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {t("DEPENDENT_PERMISSIONS.LABEL", { max: MAX_DEPENDENT_PERMISSIONS })}
          </span>
          <Badge
            variant="secondary"
            aria-label={t("DEPENDENT_PERMISSIONS.SELECTED_ARIA", {
              selected: selectedCount,
              max: MAX_DEPENDENT_PERMISSIONS,
            })}
          >
            {t("DEPENDENT_PERMISSIONS.SELECTED_BADGE", {
              selected: selectedCount,
              max: MAX_DEPENDENT_PERMISSIONS,
            })}
          </Badge>
        </div>
        {!disabled ? (
          <div className="shrink-0 self-start sm:self-center">
            <AddDependentPermission onChange={onChange} permissionsResource={permissionsResource} />
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t("DEPENDENT_PERMISSIONS.HINT")}</p>
      <div className="flex min-h-10 w-full flex-wrap items-center gap-2 rounded-sm border p-2">
        {selectedCount > 0 ? (
          permissionsResource.map((item) => (
            <Badge variant="outline" className="max-w-full w-fit break-all" key={item}>
              {item}
              {!disabled ? (
                <X
                  className="ml-2 aspect-square w-3 shrink-0 cursor-pointer"
                  onClick={() => onRemoveHandler(item)}
                  aria-label={t("DEPENDENT_PERMISSIONS.REMOVE_ARIA", { name: item })}
                />
              ) : null}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">{t("DEPENDENT_PERMISSIONS.EMPTY")}</span>
        )}
      </div>
    </div>
  );
}
