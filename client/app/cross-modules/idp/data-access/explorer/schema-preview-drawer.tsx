import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui-kits/drawer/drawer";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { Eye, X } from "lucide-react";
import { useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import atomDark from "react-syntax-highlighter/dist/esm/styles/prism/atom-dark";
import prism from "react-syntax-highlighter/dist/esm/styles/prism/prism";
import type { PlatformSchemaField } from "../data-access.service";
import { buildStructurePreview } from "./explorer-utils";

const HIGHLIGHTER_STYLE = { margin: 0, background: "transparent", padding: 0, fontSize: "0.75rem", lineHeight: 1.6 };

/**
 * The Data Gateway's preview drawer, Schema Structure only: the entity's shape
 * as JSON. Its Request Format tab is GraphQL, which does not serve platform schemas.
 */
export function SchemaPreviewDrawer({
  schemaName,
  fields,
  open,
  onOpenChange,
}: Readonly<{
  schemaName: string;
  fields: PlatformSchemaField[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const formattedJson = useMemo(() => JSON.stringify(buildStructurePreview(fields), null, 2), [fields]);

  return (
    <Drawer direction="right" handleOnly open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="inset-y-0 left-auto right-0 mt-0 h-full w-full rounded-none border-l border-border/40 bg-background md:w-[48vw] md:max-w-2xl [&>div:first-child]:hidden transition-all duration-300 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
        style={{ userSelect: "text" }}
      >
        <div className="relative flex h-full flex-col overflow-hidden">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,102,241,0.05),transparent_55%)]" />
          <div className="relative flex shrink-0 items-center justify-between gap-4 border-b border-border/40 px-6 py-4">
            <DrawerTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Eye className="h-4 w-4 text-indigo-400" />
              {schemaName} preview
            </DrawerTitle>
            <DrawerDescription className="sr-only">Preview of the schema structure.</DrawerDescription>
            <DrawerClose asChild>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </DrawerClose>
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden p-6">
            <div className="group relative h-full">
              <div className="absolute right-4 top-3 z-50 opacity-0 transition-opacity group-hover:opacity-100">
                <CopyToClipboardButton textToCopy={formattedJson}> </CopyToClipboardButton>
              </div>
              <ScrollArea className="h-full rounded-sm border border-border/60 bg-muted/30 pr-4">
                <div className="block p-5 pr-20 dark:hidden">
                  <SyntaxHighlighter language="json" style={prism} customStyle={HIGHLIGHTER_STYLE} wrapLongLines>
                    {formattedJson}
                  </SyntaxHighlighter>
                </div>
                <div className="hidden p-5 pr-20 dark:block">
                  <SyntaxHighlighter language="json" style={atomDark} customStyle={HIGHLIGHTER_STYLE} wrapLongLines>
                    {formattedJson}
                  </SyntaxHighlighter>
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
