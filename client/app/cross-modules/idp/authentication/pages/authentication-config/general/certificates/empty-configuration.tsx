import { EmptyState } from "@/components/ui-kits/empty-state";
import { Button } from "@/components/ui-kits/button/button";
import { Globe, Plus } from "lucide-react";

export const EmptyConfiguration = ({ onAdd }: Readonly<{ onAdd: () => void }>) => {
  return (
    <EmptyState
      icon={Globe}
      title="No external IdP yet"
      description="Add your first external identity provider to get started."
      action={
        <Button size="sm" onClick={onAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add provider
        </Button>
      }
    />
  );
};
