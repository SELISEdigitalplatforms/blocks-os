import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { DashboardSectionCard } from "@seliseblocks/blocks-kit/components";
import { DomainFormDialog } from "./domain-form-dialog";
import { DomainTable } from "./domain-table";
import type { IDomain } from "@seliseblocks/blocks-kit/models";

interface DomainsSectionProps {
  applications: IDomain[];
}

export const DomainsSection = ({ applications }: DomainsSectionProps) => {
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
        title="Domains"
        description="Domains and cookie domains configured for this project"
        contentClassName="p-0"
        headerRight={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Domain
          </Button>
        }>
        <DomainTable data={applications} />
      </DashboardSectionCard>
    </>
  );
};
