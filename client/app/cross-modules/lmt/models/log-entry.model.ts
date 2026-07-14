export type LogServiceStatus = "running"

export type LogServiceIconKey =
  | "iam"
  | "os"
  | "monitor"
  | "localization"
  | "data"
  | "logic"
  | "release"
  | "utilities"
  | "studio"
  | "agent"

export type LogServiceRow = {
  id: string
  name: string
  routeSlug: string
  description: string
  icon: LogServiceIconKey
  status: LogServiceStatus
}
