export type LogServiceStatus = "running"

export type LogServiceRow = {
  id: string
  name: string
  routeSlug: string
  description: string
  status: LogServiceStatus
}
