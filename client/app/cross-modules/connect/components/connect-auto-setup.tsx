import { useConnectAutoSetup } from "@/cross-modules/connect/hooks/use-connect-auto-setup";

/** Renders nothing; mounted beside the environment routes so it runs on any page. */
export function ConnectAutoSetup() {
  useConnectAutoSetup();
  return null;
}
