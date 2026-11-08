import { tStatic } from "@seliseblocks/genesis-os";
import type { ReactNode } from "react";

const I18N_MODULE = "os.idp.settings";

export const formatBoolean = (value: boolean | null | undefined) =>
  tStatic(I18N_MODULE, value ? "common:YES" : "common:NO");

export const formatList = (values: string[] | undefined | null): string =>
  values && values.length > 0 ? values.join(", ") : tStatic(I18N_MODULE, "FORMAT_CONFIG.NONE");

export const formatMinutes = (value: number | null | undefined): string => {
  const minutes = value === null || value === undefined ? 0 : value;
  return tStatic(I18N_MODULE, "FORMAT_CONFIG.MINUTES", { count: minutes });
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
