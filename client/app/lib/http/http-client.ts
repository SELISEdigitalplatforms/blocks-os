import { getRuntimeEnv } from "@/lib/runtime-env";
import { HttpClient } from "@seliseblocks/genesis-os/lib";
import {
  createHttpFailureReporter,
  getRollbar,
} from "@seliseblocks/genesis-os/observability";
import { SERVICE_NAME } from "@/constants/service.constant";

export const http = new HttpClient({
  baseURL: getRuntimeEnv("BLOCKS_OS_BASE_URL") || "",
  blocksKey: getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "",
  // Only failures that never reached the server -- API unreachable, DNS, CORS, TLS. Anything with
  // an HTTP status is left alone: a 4xx is a business outcome the UI already surfaces, and a 5xx is
  // reported server-side with a real stack trace.
  onError: createHttpFailureReporter(getRollbar({ service: SERVICE_NAME })),
});
