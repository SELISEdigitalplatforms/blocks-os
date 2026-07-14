import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs"
import { LMTQueryAgentSheet } from "@blocks-ai/components/lmt-query-agent/lmt-query-agent-sheet"
import { LOG_SERVICE_ICONS } from "@blocks-lmt/constants/logs-dummy.constant"
import { useQueryState } from "nuqs"
import { useContext, useEffect } from "react"
import { LogsViewerContext } from "../logs-viewer/logs-viewer"

export const LogsListHeader = () => {
  const { services, changeService, predefinedQueries, agentName, askAiDescription } =
    useContext(LogsViewerContext)
  const [tab, setTab] = useQueryState("tab", { defaultValue: services[0]?.serviceName ?? "" })

  useEffect(() => {
    const defaultTab = services[0]?.serviceName ?? ""
    if (!defaultTab) return

    const matchedService = tab ? services.find((item) => item.serviceName === tab) : undefined

    if (matchedService) {
      changeService(matchedService)
      return
    }

    if (tab !== defaultTab) {
      void setTab(defaultTab)
    }
  }, [changeService, services, setTab, tab])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        {services.length > 0 && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-[42px] bg-blocks-primary-shades-300">
              {services.map((item) => (
                <TabsTrigger key={item.id} value={item.serviceName} className="h-8 w-fit">
                  {item.icon ? (
                    (() => {
                      const Icon = LOG_SERVICE_ICONS[item.icon]
                      return <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    })()
                  ) : null}
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        <LMTQueryAgentSheet
          agentName={agentName}
          description={askAiDescription}
          questions={predefinedQueries}
        />
      </div>
    </div>
  )
}
