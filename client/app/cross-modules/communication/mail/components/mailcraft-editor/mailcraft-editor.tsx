import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { EditorHandle } from "@seliseblocks/mailcraft";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useTheme } from "@seliseblocks/genesis-os/hooks";
import {
  createMailcraftStorageProvider,
  MAILCRAFT_STORAGE_LIMITS,
} from "@blocks-communication/mail/services/mailcraft-storage";

export interface IMailcraftEditorProps {
  /** Fired when the host asks the editor to save (via the `submit()` handle). */
  onSave(data: { htmlFile: string }): void;
  onTemplateLoad?: (isLoaded: boolean) => void;
  /** Initial email HTML; the exported HTML of a previous session round-trips. */
  html?: string;
  templateName?: string;
  /** Removes MailCraft's standalone outer frame when it is hosted inside an app page. */
  embedded?: boolean;
}

export interface IMailcraftEditorRef {
  submit(): void;
  reset(): void;
}

/**
 * Host wrapper around the <mailcraft-editor> Web Component (mounted through
 * createEditor). The package makes no network requests of its own: image
 * listing/upload/delete run through the Blocks storage service, and the
 * template HTML is saved by the host via onSave.
 */
const MailcraftEditor = forwardRef<IMailcraftEditorRef, IMailcraftEditorProps>(
  function MailcraftEditorInner({ onSave, onTemplateLoad, html, templateName, embedded }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<EditorHandle | null>(null);
    // Uploads live in a root directory named after the organization, so the
    // id is host state, not something the storage layer can infer.
    const organizationId = useProjectStore()?.selectedProject?.organizationIds?.[0] ?? "";
    const { resolvedTheme } = useTheme();

    // Latest props live in refs so the mount effect runs exactly once —
    // re-creating the editor would discard the user's work in progress.
    const onSaveRef = useRef(onSave);
    const onTemplateLoadRef = useRef(onTemplateLoad);
    const initialRef = useRef({ html, templateName, resolvedTheme, embedded });

    useEffect(() => {
      onSaveRef.current = onSave;
    }, [onSave]);

    useEffect(() => {
      onTemplateLoadRef.current = onTemplateLoad;
    }, [onTemplateLoad]);

    useEffect(() => {
      let disposed = false;

      // Dynamic import: the module registers a custom element as a side
      // effect, so it must only ever run in the browser.
      import("@seliseblocks/mailcraft")
        .then(({ createEditor }) => {
          if (disposed || !containerRef.current) {
            return;
          }
          const {
            html: initialHtml,
            templateName: initialName,
            resolvedTheme: initialTheme,
            embedded: isEmbedded,
          } = initialRef.current;
          editorRef.current = createEditor(containerRef.current, {
            ...(initialHtml ? { html: initialHtml, name: initialName ?? "" } : {}),
            // Setting `theme` hands light/dark to the host and hides the
            // editor's own toggle, so it isn't also dropped from the bar.
            theme: initialTheme,
            toolbar: { logo: false, ai: false, status: false },
            storageProvider: createMailcraftStorageProvider({ organizationId }),
            storageLimits: MAILCRAFT_STORAGE_LIMITS,
            replace: true,
          });
          if (isEmbedded) {
            const embeddedStyle = document.createElement("style");
            embeddedStyle.textContent = `
              #mc { padding: 0 !important; }
              #mc .mc-shell {
                border: 0 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
              }
            `;
            editorRef.current.element.shadowRoot?.appendChild(embeddedStyle);
          }
          onTemplateLoadRef.current?.(true);
        })
        .catch((error) => {
          console.error("MailCraft editor initialization failed --> ", error);
        });

      return () => {
        disposed = true;
        editorRef.current?.destroy();
        editorRef.current = null;
      };
    }, [organizationId]);

    // `theme` is a plain attribute, not a settable element property, so a
    // host theme change after mount is pushed through setAttribute — the
    // create-time option above only covers the theme at first paint.
    useEffect(() => {
      editorRef.current?.element.setAttribute("theme", resolvedTheme);
    }, [resolvedTheme]);

    useImperativeHandle(
      ref,
      () => ({
        submit() {
          const editor = editorRef.current;
          if (!editor) {
            return;
          }
          onSaveRef.current({ htmlFile: editor.exportHtml() });
        },
        reset() {
          const { html: initialHtml, templateName: initialName } = initialRef.current;
          editorRef.current?.loadTemplate({
            name: initialName ?? "",
            html: initialHtml ?? "",
          });
        },
      }),
      [],
    );

    // The page supplies the height (the editor element is height: 100% of its
    // container); sizing against 100vh here ignored the chrome above and put
    // the page into document scroll, sliding the toolbar under the sticky header.
    return <div ref={containerRef} className="h-full min-h-0 w-full" />;
  },
);

export default MailcraftEditor;
