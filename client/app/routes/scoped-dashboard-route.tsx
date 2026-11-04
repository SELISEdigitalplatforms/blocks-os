import { useT } from "@seliseblocks/genesis-os";
import { DashboardRoute } from "@seliseblocks/genesis-os/layouts";
import type { ComponentProps } from "react";

/**
 * Genesis `DashboardRoute` copies each menu (`{ ...menu }`) to scope its path, which reads the
 * name getters once and freezes them. It never re-renders on a language change, so the sidebar
 * kept the old language — even after collapsing and re-opening a section. Subscribing here
 * re-renders it, and the fresh copies pick up the new texts.
 */
export function ScopedDashboardRoute(props: ComponentProps<typeof DashboardRoute>) {
  useT("os.shared");
  return <DashboardRoute {...props} />;
}
