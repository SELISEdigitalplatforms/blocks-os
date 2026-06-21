import { Button } from "@/components/ui-kits/button/button"
import { Card, CardContent } from "@/components/ui-kits/card/card"
import { DUMMY_LOG_SERVICES } from "@blocks-lmt/constants/logs-dummy.constant"
import type { LogServiceRow } from "@blocks-lmt/models/log-entry.model"
import {
  ArrowRight,
  LineChart,
  Network,
  Shield,
  type LucideIcon
} from "lucide-react"
import { type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"

const SERVICE_ICONS: Record<string, LucideIcon> = {
  "blocks-iam": Shield,
  "blocks-os": Network,
  "blocks-monitor": LineChart,
}

const LogServiceCard = ({
  service,
  onSelect,
}: {
  service: LogServiceRow
  onSelect: (routeSlug: string) => void
}) => {
  const Icon = SERVICE_ICONS[service.id] ?? Shield

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onSelect(service.routeSlug)
    }
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`View logs for ${service.name}`}
      className="group flex h-full cursor-pointer flex-col rounded-lg border border-border bg-card shadow-none transition-shadow duration-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => onSelect(service.routeSlug)}
      onKeyDown={handleKeyDown}
    >
      <CardContent className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" aria-hidden />
            </div>
            <h3 className="truncate text-base font-semibold text-high-emphasis">{service.name}</h3>
          </div>
        </div>

        <p className="mt-4 flex-1 text-sm leading-relaxed text-medium-emphasis">
          {service.description}
        </p>

        <Button
          type="button"
          className="mt-5 w-full gap-2 shadow-none"
          onClick={(event) => {
            event.stopPropagation()
            onSelect(service.routeSlug)
          }}
        >
          View Logs
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </CardContent>
    </Card>
  )
}

export const LogsOverview = () => {
  const navigate = useNavigate()

  const handleSelect = (routeSlug: string) => {
    navigate(`/services/lmt/logs/${routeSlug}`)
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {DUMMY_LOG_SERVICES.map((service) => (
        <LogServiceCard key={service.id} service={service} onSelect={handleSelect} />
      ))}
    </div>
  )
}
