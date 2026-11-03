import { useT } from "@seliseblocks/genesis-os";
import { Accordion } from "@/components/ui-kits/accordion/accordion";
import { useMemo, useState } from "react";
import { PermissionGroupSection } from "./permission-group-section";
import { PermissionGroup, useRoleDetailsStore } from "./role-details-state";
import { Card, CardContent } from "@/components/ui-kits/card/card";
type GroupedPermissions = Record<string, PermissionGroup>;
export const PermissionsSelectionPanel = () => {
  const { t } = useT("os.idp.roles");
  const [accordionValue, setAccordionValue] = useState<string>("");
  const permissionMap = useRoleDetailsStore((state) => state.permissionMap);
  const groupedPermissions = useMemo(() => {
    const groups: GroupedPermissions = {};
    permissionMap.forEach((permission) => {
      const groupName = permission.resourceGroup || t("PERMISSIONS_SELECTION_PANEL.UNGROUPED");
      if (!groups[groupName]) {
        groups[groupName] = { name: groupName, permissions: [] };
      }
      groups[groupName].permissions.push(permission);
    });
    return Object.values(groups);
  }, [permissionMap, t]);
  const onTriggerHandler = (groupName: string) => {
    setAccordionValue((prev) => (prev === groupName ? "" : groupName));
  };
  return (
    <Card>
      <CardContent>
        <Accordion
          type="single"
          collapsible
          value={accordionValue}
          onValueChange={setAccordionValue}
        >
          {groupedPermissions.map((group) => (
            <PermissionGroupSection
              key={group.name}
              group={group}
              onTrigger={() => onTriggerHandler(group.name)}
            />
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};
