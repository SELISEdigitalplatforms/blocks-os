import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { LMTQueryAgentSheet } from "@blocks-ai/components/lmt-query-agent/lmt-query-agent-sheet";
import { useQueryState } from "nuqs";
import { useContext } from "react";
import { LogsViewerContext } from "../logs-viewer/logs-viewer";

export const LogsListHeader = () => {
  const { predefinedQueries, agentName, askAiDescription } = useContext(LogsViewerContext);
  const [source, setSource] = useQueryState("source", {
    defaultValue: "blocks",
  });

  return (
    <div className="flex items-center justify-between gap-4">
      <Tabs value={source} onValueChange={setSource}>
        <TabsList className="h-[42px] bg-blocks-primary-shades-300">
          <TabsTrigger value="blocks" className="h-8 w-fit">
            Managed Service
          </TabsTrigger>
          <TabsTrigger value="managed" className="h-8 w-fit">
            My Service
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <LMTQueryAgentSheet
        agentName={agentName}
        description={askAiDescription}
        questions={predefinedQueries}
      />
    </div>
  );
};
