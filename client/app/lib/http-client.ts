import { getRuntimeEnv } from "@/lib/runtime-env";
import { HttpClient } from "@seliseblocks/blocks-kit";

export const http = new HttpClient({
  baseURL: getRuntimeEnv("BLOCKS_OS_BASE_URL") || "",
  blocksKey: getRuntimeEnv("BLOCKS_X_BLOCKS_KEY") || "",
});

export { HttpClient };
