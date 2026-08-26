import { ErrorBoundary, Provider } from "@rollbar/react";
import type * as React from "react";
import { Button } from "@/components/ui-kits/button/button";
import { getRollbar } from "@/lib/rollbar";

/**
 * Shown instead of a blank page when a render throws. Deliberately plain: it has to render when
 * the app's own state is already known-bad, so it depends on nothing but theme tokens.
 */
const AppCrashFallback = ({ resetError }: { error: Error | null; resetError: () => void }) => (
  <div
    className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center"
    role="alert"
  >
    <div className="space-y-1">
      <p className="text-lg font-semibold text-foreground">Something went wrong</p>
      <p className="text-sm text-medium-emphasis">
        The error has been reported. Try again, or reload the page if it keeps happening.
      </p>
    </div>
    <Button onClick={resetError}>Try again</Button>
  </div>
);

/**
 * Puts Rollbar in front of the whole tree.
 *
 * Outermost on purpose: mounted above the query, theme and router providers so a throw during
 * their own setup is still caught and reported rather than blanking the page. Reporting itself is
 * inert until a client token is seeded -- see `@/lib/rollbar` -- but the boundary is always live,
 * so the fallback above is exercised in local development too.
 *
 * Frontend stack traces stay minified until source maps are uploaded to Rollbar; that needs a
 * `code_version` shared between the Vite build and the upload, and the image build runs through a
 * central reusable workflow, so it is deliberately not wired here.
 */
export default function RollbarProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider instance={getRollbar()}>
      <ErrorBoundary fallbackUI={AppCrashFallback} level="critical">
        {children}
      </ErrorBoundary>
    </Provider>
  );
}
