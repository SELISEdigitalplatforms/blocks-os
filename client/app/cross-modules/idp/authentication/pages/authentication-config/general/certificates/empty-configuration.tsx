import { EmptyState } from "@/components/ui-kits/empty-state";
import { Globe } from "lucide-react";

export const EmptyConfiguration = () => {
  return (
    <EmptyState
      icon={Globe}
      title="No external IdP yet"
      description="Add your first external identity provider to get started."
    />
  );
};
