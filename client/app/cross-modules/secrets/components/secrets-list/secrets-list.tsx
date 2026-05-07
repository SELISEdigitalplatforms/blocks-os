import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { MaskedText } from "@/components/masked-text";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { formatDate, parseDateString } from "@/lib/utils";
import { SecretType, SECRET_TYPE_OPTIONS, type SecretItem } from "../../constants/secret-key.enum";
import { useGetSecrets } from "../../hooks/use-secrets";

// ─── Loading Skeleton ────────────────────────────────────────────────────────
const LoadingSkeleton = () => (
  <div className="grid gap-4">
    {Array.from({ length: 3 }).map((_, i) => (
      <Card key={i}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32 rounded" />
            <Skeleton className="h-6 w-20 rounded" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-3 w-20 rounded" />
                <Skeleton className="h-5 w-36 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// ─── Empty State ─────────────────────────────────────────────────────────────
const EmptyState = ({ label }: { label: string }) => (
  <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card text-center text-muted-foreground">
    <KeyRound className="h-8 w-8 opacity-40" />
    <p className="text-sm">No {label} secrets found.</p>
  </div>
);

// ─── Key-Value Item ──────────────────────────────────────────────────────────
const KvItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <CopyToClipboardButton textToCopy={value}>
      <MaskedText text={value} length={28} showFirstN={3} showLastN={3} />
    </CopyToClipboardButton>
  </div>
);

// ─── Secret Card ─────────────────────────────────────────────────────────────
const SecretCard = ({ item }: { item: SecretItem }) => {
  const kvEntries = item.keyValuePairs
    ? (Object.entries(item.keyValuePairs) as [string, string][])
    : ([] as [string, string][]);
  const createdAt = item.createdAt
    ? formatDate(parseDateString(item.createdAt))
    : null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle className="text-base">
            <MaskedText text={item.itemId} length={32} showFirstN={8} showLastN={8} />
          </CardTitle>
          {createdAt && (
            <p className="text-xs text-muted-foreground">Created {createdAt}</p>
          )}
        </div>
        <Badge variant="secondary">{item.secretKey}</Badge>
      </CardHeader>
      {kvEntries.length > 0 && (
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {kvEntries.map(([key, val]) => (
              <KvItem key={key} label={key} value={val} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

// ─── Per-Type List ────────────────────────────────────────────────────────────
function SecretTypeList({ secretKey, label }: { secretKey: string; label: string }) {
  const { data, isLoading } = useGetSecrets(secretKey);

  if (isLoading) return <LoadingSkeleton />;
  if (!data?.length) return <EmptyState label={label} />;

  return (
    <div className="grid gap-4">
      {data.map((item) => (
        <SecretCard key={item.itemId} item={item} />
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SecretsList() {
  const [activeType, setActiveType] = useState<SecretType>(SecretType.OIDC);

  return (
    <Tabs value={activeType} onValueChange={(v) => setActiveType(v as SecretType)}>
      <TabsList className="mb-4">
        {SECRET_TYPE_OPTIONS.map((opt) => (
          <TabsTrigger key={opt.value} value={opt.value}>
            {opt.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {SECRET_TYPE_OPTIONS.map((opt) => (
        <TabsContent key={opt.value} value={opt.value}>
          <SecretTypeList secretKey={opt.value} label={opt.label} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
