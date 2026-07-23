// The generic project-id path builder lives in blocks-kit so every app can
// reuse it; re-exported here so blocks-os call sites keep a local import.
import { useScopedPath } from "@seliseblocks/blocks-kit/hooks";

/**
 * The LMT section base path scoped to the active project id
 * (`/app/:itemId/lmt`). Works for both building links and matching the current
 * pathname, since the pathname carries the same id. LMT is a blocks-os module,
 * so this convenience stays app-side, built on the generic {@link useScopedPath}.
 */
export const useLmtBasePath = () => useScopedPath()("lmt");
