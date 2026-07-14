import { Card, CardContent } from "@/components/ui-kits/card/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select"
import { useGetAllServices } from "@blocks-identifier/hooks/use-services"
import { LogsViewer, type Service } from "@blocks-lmt/components"
import { BLOCKS_LOG_SERVICES } from "@blocks-lmt/constants/logs-dummy.constant"
import {
  LOG_SERVICE_AI_DESCRIPTION,
  LOG_SERVICE_AI_QUERIES,
} from "@blocks-lmt/constants/logs-service-meta.constant"
import { useProjectStore } from "@seliseblocks/blocks-kit"
import { useMemo, useState } from "react"

type LogSource = "blocks" | "managed"

const BLOCKS_SERVICES: Service[] = BLOCKS_LOG_SERVICES.map((service) => ({
  id: service.id,
  label: service.label,
  serviceName: service.id,
  serviceNames: service.serviceNames,
  icon: service.icon,
}))

const SOURCE_OPTIONS: { label: string; value: LogSource }[] = [
  { label: "Blocks services", value: "blocks" },
  { label: "Managed services", value: "managed" },
]

export function LogsRoute() {
  const [source, setSource] = useState<LogSource>("blocks")
  const tenantId = useProjectStore().selectedProject?.tenantId || ""
  const { data, isLoading, isFetching } = useGetAllServices({
    projectKey: tenantId,
    page: 0,
    pageSize: 1000,
  })

  const managedServices = useMemo<Service[]>(
    () =>
      data?.data.map((service) => ({
        id: service.serviceId,
        label: service.name,
        serviceName: service.serviceId,
        serviceNames: [service.serviceId],
      })) ?? [],
    [data?.data],
  )

  const services = source === "blocks" ? BLOCKS_SERVICES : managedServices
  const isManagedLoading = source === "managed" && (isLoading || isFetching)
  const predefinedQueries =
    source === "blocks" ? Object.values(LOG_SERVICE_AI_QUERIES).flat() : []

  return (
    <div className="flex flex-col gap-5 sm:gap-4">
      <div className="flex items-center justify-between gap-4">
        <Select value={source} onValueChange={(value) => setSource(value as LogSource)}>
          <SelectTrigger className="h-9 w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isManagedLoading ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Loading managed services...
          </CardContent>
        </Card>
      ) : source === "managed" && services.length === 0 ? (
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No managed services found.
          </CardContent>
        </Card>
      ) : (
        <LogsViewer
          key={source}
          services={services}
          predefinedQueries={predefinedQueries}
          askAiDescription={LOG_SERVICE_AI_DESCRIPTION}
          agentName="Ask AI"
          useGenericTraceLinks
        />
      )}
    </div>
  )
}
