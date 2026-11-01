import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { LMTQueryAgentSheet } from "@blocks-ai/components/lmt-query-agent/lmt-query-agent-sheet";
import { TRACE_PROVIDERS } from "@blocks-lmt/constants/trace.constant";
import { useQueryState } from "nuqs";
import { useContext } from "react";
import type { StorageTier } from "../storage-tier-cards/storage-tier-cards";
import { StorageTierSwitcher } from "../storage-tier-cards/storage-tier-switcher";
import { LogsViewerContext } from "../logs-viewer/logs-viewer";
import { useT, tStatic } from "@seliseblocks/genesis-os";

/** What each tier holds, in the words of this page: logs rather than telemetry in general. */
const LOG_TIER_DESCRIPTIONS: Partial<Record<StorageTier, string>> = {
  get [TRACE_PROVIDERS.hot]() { return tStatic("os.lmt", "LOGS_HEADER.LIVE_AND_RECENT_LOGS"); },
  get [TRACE_PROVIDERS.cold]() { return tStatic("os.lmt", "LOGS_HEADER.LONGER_TERM_STORED_LOGS"); },
  get [TRACE_PROVIDERS.archive]() { return tStatic("os.lmt", "LOGS_HEADER.DEEP_HISTORY_RETAINED_FOR_AUDIT"); },
};

export const LogsListHeader = () => {
  const { t } = useT("os.lmt");
  const {
    predefinedQueries,
    agentName,
    askAiDescription,
    tier,
    canSwitchTier,
    changeTier,
    showAgent,
  } = useContext(LogsViewerContext);
  const [source, setSource] = useQueryState("source", {
    defaultValue: "blocks",
  });
  // The agent queries hot storage. Offered beside restored rows it would answer about days
  // other than the ones on screen, so it is withheld there rather than quietly misleading.
  // A page that hosts the agent in its own page header turns it off here -- see
  // LogsViewerContextType.showAgent.
  const canAskAgent = showAgent && tier === TRACE_PROVIDERS.hot;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={source} onValueChange={setSource}>
        <TabsList className="h-[42px] bg-blocks-primary-shades-300">
          <TabsTrigger value="blocks" className="h-8 w-fit">
            {t("LOGS_HEADER.MANAGED_SERVICE")}
          </TabsTrigger>
          <TabsTrigger value="managed" className="h-8 w-fit">
            {t("LOGS_HEADER.MY_SERVICE")}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-3">
        {canSwitchTier && (
          <StorageTierSwitcher
            value={tier}
            onChange={changeTier}
            descriptions={LOG_TIER_DESCRIPTIONS}
          />
        )}
        {canAskAgent && (
          <LMTQueryAgentSheet
            agentName={agentName}
            description={askAiDescription}
            questions={predefinedQueries}
          />
        )}
      </div>
    </div>
  );
};
