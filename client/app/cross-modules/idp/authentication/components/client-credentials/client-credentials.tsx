import { ClientCredentialList } from "./client-credentials-list";
import { useListAuthClientCredentials } from "@blocks-idp/authentication/hooks/use-auth-clients";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { parseAsBoolean, parseAsString, useQueryState } from "nuqs";

// type SummaryTileProps = {
//   label: string;
//   value: number;
// };

// const SummaryTile = ({ label, value }: SummaryTileProps) => (
//   <div className="rounded-sm border bg-card px-5 py-4 shadow-sm">
//     <p className="text-xs font-medium uppercase tracking-wide text-low-emphasis">
//       {label}
//     </p>
//     <p className="mt-1 text-2xl font-semibold text-high-emphasis">{value}</p>
//   </div>
// );

export const ClientCredentials = () => {
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data, isLoading, isFetching } = useListAuthClientCredentials({
    projectKey: tenantId,
  });
  const [, setIsClientCredentialOpen] = useQueryState(
    "clientCredentialOpen",
    parseAsBoolean.withDefault(false),
  );
  const [, setClientCredentialItemId] = useQueryState(
    "clientCredentialItemId",
    parseAsString.withDefault(""),
  );

  const handleEdit = (client: { itemId: string } | null | undefined) => {
    if (!client) {
      setClientCredentialItemId("");
    } else {
      setClientCredentialItemId(client.itemId);
    }
    setIsClientCredentialOpen(true);
  };

  const credentials = data ?? [];
  // const total = credentials.length;
  // const active = credentials.filter((c) => c.isActive).length;
  // const inactive = total - active;
  // const showSummary = !isLoading && !isFetching && total > 0;

  return (
    <div className="min-w-0">
      {/* {showSummary && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <SummaryTile label="Total credentials" value={total} />
          <SummaryTile label="Active" value={active} />
          <SummaryTile label="Inactive" value={inactive} />
        </div>
      )} */}
      <div className="relative">
        <ClientCredentialList
          data={credentials}
          isLoading={isLoading || isFetching}
          onEdit={handleEdit}
        />
      </div>
    </div>
  );
};
