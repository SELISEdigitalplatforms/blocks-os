import "@seliseblocks/genesis-os/lib";
import "@/styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { Toaster } from "./components/ui-kits/toaster/toaster";
import { TooltipProvider } from "./components/ui-kits/tooltip/tooltip";
import QueryProvider from "./providers/query-provider";
import RollbarProvider from "./providers/rollbar-provider";
import { router } from "./router";
import { BlocksAppLayout, ThemeProvider } from "@seliseblocks/genesis-os/providers";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RollbarProvider>
      <QueryProvider>
        <ThemeProvider>
          <NuqsAdapter>
            <TooltipProvider>
              <BlocksAppLayout
                config={{
                  name: "blocks-os",
                  appLogoUrl: {
                    dark: "/blocks-logos/os_dark_mode.svg",
                    light: "/blocks-logos/os_light_mode.svg",
                  },
                }}
              >
                <RouterProvider router={router} />
              </BlocksAppLayout>
              <Toaster />
            </TooltipProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </QueryProvider>
    </RollbarProvider>
  </StrictMode>,
);
