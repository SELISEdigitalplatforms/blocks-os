import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { consumeDeepLink, resolveDeepLinkTarget } from "@/lib/deep-link";

type DeepLinkRedirectProps = {
  /** Whether a pathname is a real route, so an unknown path stays on the dashboard. */
  isRoute: (pathname: string) => boolean;
};

/**
 * Mounted on the environment dashboard, where every way into an environment lands once access
 * is granted. Sends the user on to the path they asked for before signing in. Renders nothing.
 */
export function DeepLinkRedirect({ isRoute }: Readonly<DeepLinkRedirectProps>) {
  const { itemId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!itemId) return;
    const path = consumeDeepLink();
    if (!path) return;
    const target = resolveDeepLinkTarget(itemId, path, isRoute);
    if (target && target !== `/app/${itemId}/dashboard`) navigate(target, { replace: true });
  }, [itemId, isRoute, navigate]);

  return null;
}
