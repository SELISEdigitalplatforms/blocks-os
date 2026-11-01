import { EmptyState } from "@/components/ui-kits/empty-state";
import { Button } from "@/components/ui-kits/button/button";
import { Globe, Plus } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";

export const EmptyConfiguration = ({ onAdd }: Readonly<{ onAdd: () => void }>) => {
  const { t } = useT("os.idp.auth");
  return (
    <EmptyState
      icon={Globe}
      title={t("EMPTY_CONFIGURATION.TITLE")}
      description={t("EMPTY_CONFIGURATION.DESCRIPTION")}
      action={
        <Button size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          {t("EMPTY_CONFIGURATION.ADD_PROVIDER")}
        </Button>
      }
    />
  );
};
