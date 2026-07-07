import { useState } from "react";
import { ClientCredentialList } from "./client-credentials-list";
import { CreateClientCredential } from "@blocks-idp/authentication/components/create-client-credential/create-client-credential";
import { useListAuthClientCredentials } from "@blocks-idp/authentication/hooks/use-auth-clients";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { IClientCredentialsConfig } from "@blocks-idp/authentication/models/auth.oidc.model";
import { Button } from "@/components/ui-kits/button/button";
import { Plus } from "lucide-react";

type SummaryTileProps = {
  label: string;
  value: number;
};

const SummaryTile = ({ label, value }: SummaryTileProps) => (
  <div className="rounded-sm border bg-card px-5 py-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wide text-low-emphasis">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-high-emphasis">{value}</p>
  </div>
);

export const ClientCredentials = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data, isLoading, isFetching } = useListAuthClientCredentials({ projectKey: tenantId });
  const [editingClient, setEditingClient] = useState<IClientCredentialsConfig | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const credentials = data ?? [];
  const total = credentials.length;
  const active = credentials.filter((c) => c.isActive).length;
  const inactive = total - active;
  const showSummary = !isLoading && !isFetching && total > 0;

  return (
    <div>
      {showSummary && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryTile label="Total credentials" value={total} />
          <SummaryTile label="Active" value={active} />
          <SummaryTile label="Inactive" value={inactive} />
        </div>
      )}
      <div className="mb-4 flex items-center justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-5 w-5" />
          <span className="ml-2.5 text-sm">Add Client Credential</span>
        </Button>
      </div>
      <div className="relative">
        <ClientCredentialList
          data={credentials}
          isLoading={isLoading || isFetching}
          onEdit={setEditingClient}
        />
      </div>
      <CreateClientCredential open={createOpen} onOpenChange={setCreateOpen} hideTrigger />
      <CreateClientCredential
        editClient={editingClient}
        open={Boolean(editingClient)}
        onOpenChange={(open) => {
          if (!open) setEditingClient(null);
        }}
        hideTrigger
      />
    </div>
  );
};
