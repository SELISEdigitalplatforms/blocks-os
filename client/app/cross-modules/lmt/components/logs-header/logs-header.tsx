import { LMTQueryAgentSheet } from "@blocks-ai/components/lmt-query-agent/lmt-query-agent-sheet";
import { useContext } from "react";
import { LogsViewerContext } from "../logs-viewer/logs-viewer";

export const LogsListHeader = () => {
  const { predefinedQueries, agentName, askAiDescription } =
    useContext(LogsViewerContext);

  return (
    <div className="flex items-center justify-between gap-4">
      <LMTQueryAgentSheet
        agentName={agentName}
        description={askAiDescription}
        questions={predefinedQueries}
      />
    </div>
  );
};
