import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { DashboardSectionCard } from "@seliseblocks/genesis-os/components";
import { DomainFormDialog } from "./domain-form-dialog";
import { DomainTable } from "./domain-table";
import type { IDomain } from "@/models/project.model";
import { useT } from "@seliseblocks/genesis-os";

interface DomainsSectionProps {
  applications: IDomain[];
}

export const DomainsSection = ({ applications }: DomainsSectionProps) => {
  const { t } = useT("os.dashboard");
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  return (
    <>
      {/* Add dialog — self-contained here, no prop callbacks needed */}
      <DomainFormDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        // No application prop → add mode
      />

      <DashboardSectionCard
        title={t("DOMAIN_SECTION.DOMAINS")}
        description={t("DOMAIN_SECTION.DOMAINS_WHERE_YOUR_APPS_ARE")}
        contentClassName="p-0"
        headerRight={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t("DOMAIN_SECTION.ADD_DOMAIN")}
          </Button>
        }
      >
        <DomainTable data={applications} />
      </DashboardSectionCard>
    </>
  );
};
