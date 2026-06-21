export type LogServiceStatus = "running"

export type LogServiceIconKey =
  | "iam"
  | "os"
  | "monitor"
  | "localization"
  | "data"
  | "release"
  | "utilities"
  | "studio"

export type LogServiceRow = {
  id: string
  name: string
  routeSlug: string
  description: string
  icon: LogServiceIconKey
  status: LogServiceStatus
}
