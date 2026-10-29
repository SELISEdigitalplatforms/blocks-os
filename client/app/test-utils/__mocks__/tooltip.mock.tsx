/**
 * Test double for `@/components/ui-kits/tooltip/tooltip`.
 *
 * That module re-exports from `@seliseblocks/genesis-os`, whose barrel reads runtime env at import
 * time and throws under jsdom (`import.meta.env` is undefined for the published chunk). Inlining
 * the package instead resolves it to source and boots Rollbar, so mocking is the cheaper trade.
 *
 * The fake keeps the only behaviour tests need: content renders exactly while `open`.
 *
 * Usage, at the top of a test file:
 *   vi.mock("@/components/ui-kits/tooltip/tooltip", () => import("@/test-utils/__mocks__/tooltip.mock"));
 */
import { createContext, useContext, type ReactNode } from "react";

const OpenContext = createContext(false);

type Props = { children?: ReactNode };

export const TooltipProvider = ({ children }: Props) => <>{children}</>;

export const Tooltip = ({ open, children }: Props & { open?: boolean }) => (
  <OpenContext.Provider value={Boolean(open)}>{children}</OpenContext.Provider>
);

export const TooltipTrigger = ({ children }: Props) => <>{children}</>;

export const TooltipContent = ({ children }: Props) =>
  useContext(OpenContext) ? <div role="tooltip">{children}</div> : null;
