import { tStatic } from "@seliseblocks/genesis-os";

/**
 * Menu texts are read when the sidebar renders (via getters on the menu objects),
 * so a language change shows up without rebuilding the constants.
 */
export const navText = (key: string, values?: Record<string, string | number>) =>
  tStatic("os.shared", key, values);
