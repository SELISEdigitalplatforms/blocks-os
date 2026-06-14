import type { ReactNode } from "react"

export const formatBoolean = (value: boolean | undefined) =>
  value === undefined ? "—" : value ? "Yes" : "No"

export const formatList = (values: string[] | undefined): string =>
  values && values.length > 0 ? values.join(", ") : "None"

export const formatMinutes = (value: number | undefined): string =>
  value === undefined ? "—" : `${value} minutes`

export const formatText = (value: string | number | undefined | null): ReactNode =>
  value === undefined || value === null || value === "" ? "—" : value

export const joinAccountActionUrl = (baseUrl: string | undefined, path: string | undefined): string => {
  if (!baseUrl && !path) return "—"
  if (!baseUrl) return path ?? "—"
  if (!path) return baseUrl
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
}
