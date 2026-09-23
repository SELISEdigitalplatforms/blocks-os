import React, { useMemo, useState } from "react";
import { AlertCircle, Download, Mail, Paperclip } from "lucide-react";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Button } from "@/components/ui-kits/button/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { formatSize } from "@/lib/utils";
import { useGetEmailUsageById } from "@blocks-communication/mail/hooks/use-email-usage";
import { StatusBadge } from "@blocks-communication/mail/email/email-usage/status-badge";
import { EmailUsageDetailsSkeleton } from "@blocks-communication/mail/email/email-usage/email-usage-details-skeleton";
import { EmailUsageDetailsBreadcrumb } from "@blocks-communication/mail/email/email-usage/email-usage-details-breadcrumb";
import { MailAvatar } from "@blocks-communication/mail/email/email-usage/mail-avatar";
import {
  buildMailFrameDocument,
  formatMailDateLong,
  getAvatarTone,
  getInitials,
  looksLikeHtml,
  parseAddress,
  parseAddressList,
} from "@blocks-communication/mail/email/email-usage/mail-display";

type BodyView = "html" | "text" | "source";

const AddressLine = ({ label, raw }: { label: string; raw?: string | null }) => {
  const addresses = parseAddressList(raw);
  if (addresses.length === 0) return null;
  return (
    <p className="text-sm text-muted-foreground">
      <span className="mr-1">{label}</span>
      {addresses.map((address, index) => (
        <span key={`${address.email}-${index}`} title={address.email}>
          <span className="text-high-emphasis">{address.name}</span>
          {address.name !== address.email && <span> &lt;{address.email}&gt;</span>}
          {index < addresses.length - 1 && ", "}
        </span>
      ))}
    </p>
  );
};

const downloadEml = (rawMime: string, subject: string) => {
  const blob = new Blob([rawMime], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(subject || "message").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80)}.eml`;
  link.click();
  URL.revokeObjectURL(url);
};

export const EmailUsageDetails = ({ id }: { id: string }) => {
  const { data: details, isLoading } = useGetEmailUsageById(id);
  const [view, setView] = useState<BodyView | null>(null);

  const bodies = useMemo(() => {
    const content = details?.content;
    const body = details?.body || "";
    const html = content?.htmlBody || (looksLikeHtml(body) ? body : "");
    const text = content?.textBody || (!looksLikeHtml(body) ? body : "");
    return { html, text };
  }, [details]);

  if (isLoading) return <EmailUsageDetailsSkeleton />;
  if (!details) {
    return (
      <Card className="mt-6">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Mail className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Email details not found.</p>
          <p className="text-sm text-muted-foreground">
            The message may have been removed, or the link is incomplete.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sender = parseAddress(details.from);
  const attachments = details.content?.attachments ?? [];
  const availableViews: BodyView[] = [
    ...(bodies.html ? (["html"] as const) : []),
    ...(bodies.text ? (["text"] as const) : []),
    ...(details.rawMime ? (["source"] as const) : []),
  ];
  const activeView = view && availableViews.includes(view) ? view : availableViews[0];

  return (
    <main className="flex flex-col gap-6">
      <div className="hidden md:flex">
        <EmailUsageDetailsBreadcrumb id={details.messageId || id} isInbound={details.isInbound} />
      </div>

      <Card className="mt-2 shadow-none">
        <CardContent className="space-y-5 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <h1 className="break-words text-lg font-semibold text-high-emphasis md:text-2xl">
              {details.subject || <span className="italic text-muted-foreground">(no subject)</span>}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              {!details.isInbound && <StatusBadge status={details.status} />}
              {details.rawMime && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadEml(details.rawMime as string, details.subject)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download .eml
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <MailAvatar
              size="md"
              initials={getInitials(sender)}
              tone={getAvatarTone(sender.email || "?")}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-col gap-x-3 sm:flex-row sm:items-baseline sm:justify-between">
                <p className="truncate text-sm">
                  <span className="font-semibold text-high-emphasis">{sender.name || "-"}</span>
                  {sender.name !== sender.email && (
                    <span className="ml-1 text-muted-foreground">&lt;{sender.email}&gt;</span>
                  )}
                </p>
                <p
                  className="shrink-0 text-xs text-muted-foreground"
                  title={details.isInbound ? "Received" : "Sent"}
                >
                  {details.date ? formatMailDateLong(details.date) : "-"}
                </p>
              </div>
              <AddressLine label="To" raw={details.to} />
              <AddressLine label="Cc" raw={details.content?.cc} />
              <AddressLine label="Reply-To" raw={details.content?.replyTo} />
            </div>
          </div>

          {details.error && (
            <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error/5 p-3 text-sm text-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{details.error}</span>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {attachments.length} attachment{attachments.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment, index) => (
                  <div
                    key={`${attachment.fileName}-${index}`}
                    className="flex max-w-xs items-center gap-2 rounded-md border bg-muted/30 px-3 py-2"
                    title={attachment.contentType}
                  >
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm">{attachment.fileName}</span>
                    {attachment.size != null && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatSize(attachment.size)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-none">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <p className="text-sm font-medium text-high-emphasis">Message</p>
          {availableViews.length > 1 && (
            <Tabs value={activeView} onValueChange={(value) => setView(value as BodyView)}>
              <TabsList className="h-8">
                {availableViews.includes("html") && (
                  <TabsTrigger value="html" className="h-6 px-3 text-xs">
                    Formatted
                  </TabsTrigger>
                )}
                {availableViews.includes("text") && (
                  <TabsTrigger value="text" className="h-6 px-3 text-xs">
                    Plain text
                  </TabsTrigger>
                )}
                {availableViews.includes("source") && (
                  <TabsTrigger value="source" className="h-6 px-3 text-xs">
                    Original
                  </TabsTrigger>
                )}
              </TabsList>
            </Tabs>
          )}
        </div>
        <CardContent className="p-0">
          {activeView === "html" && (
            // Untrusted markup: no scripts, no same-origin access, no forms. Links may
            // only open a new tab.
            <iframe
              title="Email body"
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              srcDoc={buildMailFrameDocument(bodies.html)}
              className="block h-[70vh] w-full border-0 bg-white"
            />
          )}
          {activeView === "text" && (
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words p-5 font-sans text-sm leading-relaxed text-high-emphasis">
              {bodies.text}
            </pre>
          )}
          {activeView === "source" && (
            <pre className="max-h-[70vh] overflow-auto whitespace-pre p-5 font-mono text-xs leading-relaxed text-muted-foreground">
              {details.rawMime}
            </pre>
          )}
          {!activeView && (
            <p className="p-5 text-sm italic text-muted-foreground">This message has no body.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};
