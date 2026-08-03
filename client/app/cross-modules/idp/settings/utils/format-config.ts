import type { ReactNode } from "react";

export const formatBoolean = (value: boolean | null | undefined) =>
  value === undefined || value === null ? "No" : value ? "Yes" : "No";

export const formatList = (values: string[] | undefined | null): string =>
  values && values.length > 0 ? values.join(", ") : "None";

export const formatMinutes = (value: number | null | undefined): string => {
  const minutes = value === null || value === undefined ? 0 : value;
  return `${minutes} minutes`;
};

export const formatNumber = (value: number | null | undefined): string => {
  const number = value === null || value === undefined ? 0 : value;
  return String(number);
};

export const formatText = (value: string | number | undefined | null): ReactNode =>
  value === undefined || value === null || value === "" ? "—" : value;

export const joinAccountActionUrl = (
  baseUrl: string | undefined,
  path: string | undefined,
): string => {
  if (!baseUrl && !path) return "—";
  if (!baseUrl) return path ?? "—";
  if (!path) return baseUrl;
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
};
