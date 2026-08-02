import { useState, useEffect } from "react";
import { http } from "@/lib/http/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";

const getLogicHostname = () => {
  const base =
    getRuntimeEnv("BLOCKS_LOGIC_BASE_URL");
  try {
    return new URL(base).hostname;
  } catch {
    return "";
  }
};

/**
 * Fetches a profile image URL using the authenticated HTTP client when it points to
 * an internal logic service endpoint (which requires credentials). Returns a blob URL
 * that can be used directly in <img src>.
 *
 * For external CDN URLs (Azure Blob, S3) the URL is returned as-is.
 */
export const useProfileImageSrc = (url: string | null | undefined): string | null => {
  // Only the fetched blob needs state. The "no url" and "external CDN url"
  // cases are pure functions of the argument, so they are derived during
  // render rather than pushed into state from inside the effect.
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  // An unresolved logic host must not match every url: "".includes("") is true, which
  // would route external CDN urls through the authenticated client and fail the load.
  const logicHostname = getLogicHostname();
  const isLogicUrl =
    !!url && (url.startsWith("/") || (!!logicHostname && url.includes(logicHostname)));

  useEffect(() => {
    if (!url || !isLogicUrl) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    http
      .get<Blob>(url, undefined, { absoluteUrl: true })
      .then((result) => {
        if (cancelled) return;
        if (result instanceof Blob) {
          objectUrl = URL.createObjectURL(result);
          setBlobSrc(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setBlobSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      setBlobSrc(null);
    };
  }, [url, isLogicUrl]);

  if (!url) return null;
  if (!isLogicUrl) return url;
  return blobSrc;
};
