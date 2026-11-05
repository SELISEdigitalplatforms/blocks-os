import { useState } from "react";
import { Loader2, Plus, Webhook } from "lucide-react";
import { parseAsBoolean, useQueryState } from "nuqs";
import { Link, useNavigate } from "react-router";
import { useT } from "@seliseblocks/genesis-os";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { Button } from "@/components/ui-kits/button/button";
import { FilterControls } from "@/components/filter-toolbar";
import { EmptyState } from "@/components/ui-kits/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { WebhookFormDialog } from "../../components/webhook-form-dialog";
import { WebhookStatusBadges } from "../../components/webhook-status-badges";
import { ADD_WEBHOOK_QUERY_KEY, WEBHOOKS_I18N_MODULE } from "../../constants/webhooks.constant";
import { useGetWebhooks } from "../../hooks/use-webhooks";
import type { IWebhook } from "../../models/webhook.model";
import { formatEndpoint } from "../../utils/format";
import { filterWebhooks } from "../../utils/webhook-search";

const SHOWN_ACTION_NAMES = 2;

const detailsPath = (id: string) => `secret-management/webhooks/${encodeURIComponent(id)}`;

export function WebhooksPage() {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { data, isLoading, isError, refetch } = useGetWebhooks();
  const [isAddOpen, setIsAddOpen] = useQueryState(
    ADD_WEBHOOK_QUERY_KEY,
    parseAsBoolean.withDefault(false),
  );

  const [search, setSearch] = useState("");

  const openDetails = (id: string) => navigate(scoped(detailsPath(id)));

  const addDialog = <WebhookFormDialog open={isAddOpen} onOpenChange={setIsAddOpen} />;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={Webhook}
        title={t("LIST.LOAD_FAILED_TITLE")}
        description={t("LIST.LOAD_FAILED_DESCRIPTION")}
        action={<Button onClick={() => refetch()}>{t("common:RETRY")}</Button>}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <>
        <EmptyState
          icon={Webhook}
          title={t("LIST.EMPTY_TITLE")}
          description={t("LIST.EMPTY_DESCRIPTION")}
          action={
            <Button onClick={() => setIsAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              <span>{t("LIST.ADD")}</span>
            </Button>
          }
        />
        {addDialog}
      </>
    );
  }

  const visible = filterWebhooks(data, search);

  return (
    <>
      <div className="mb-4 flex justify-start">
        <FilterControls.SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t("LIST.SEARCH")}
          className="w-64"
        />
      </div>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("LIST.NO_MATCH")}</p>
      ) : (
        <div className="overflow-hidden rounded-sm border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("LIST.NAME")}</TableHead>
                <TableHead>{t("LIST.ENDPOINT")}</TableHead>
                <TableHead>{t("LIST.ACTIONS")}</TableHead>
                <TableHead>{t("LIST.STATUS")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((webhook) => (
                <WebhookRow key={webhook.id} webhook={webhook} onOpen={openDetails} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {addDialog}
    </>
  );
}

function WebhookRow({
  webhook,
  onOpen,
}: Readonly<{ webhook: IWebhook; onOpen: (id: string) => void }>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const scoped = useScopedPath();
  const shown = webhook.actions.slice(0, SHOWN_ACTION_NAMES).join(", ");
  const more = webhook.actions.length - SHOWN_ACTION_NAMES;

  return (
    <TableRow className="cursor-pointer" onClick={() => onOpen(webhook.id)}>
      <TableCell className="font-medium">
        <Link
          to={scoped(detailsPath(webhook.id))}
          className="text-high-emphasis hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {webhook.name}
        </Link>
      </TableCell>
      <TableCell>
        <code className="text-xs text-muted-foreground">{formatEndpoint(webhook.url)}</code>
      </TableCell>
      <TableCell>
        <div className="text-sm">{t("LIST.ACTIONS_COUNT", { count: webhook.actions.length })}</div>
        <div className="truncate text-xs text-muted-foreground">
          {shown}
          {more > 0 && ` +${more}`}
        </div>
      </TableCell>
      <TableCell>
        <WebhookStatusBadges webhook={webhook} />
      </TableCell>
    </TableRow>
  );
}
