import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Download, Loader2, Mail, Paperclip } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useT } from "@seliseblocks/genesis-os";
import { emailService } from "@blocks-communication/mail/services/email.services";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Button } from "@/components/ui-kits/button/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { formatSize } from "@/lib/utils";
import {
  useFetchEmailUsageSource,
  useGetEmailUsageById,
  useGetEmailUsageSource,
} from "@blocks-communication/mail/hooks/use-email-usage";
import type { IMailBoxMailAttachment } from "@blocks-communication/mail/models/email";
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

const saveBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const emlFileName = (subject: string) =>
  `${(subject || "message").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80)}.eml`;

// Larger arguments risk exceeding the engine's argument limit in String.fromCharCode.
const CHAR_CODE_CHUNK = 32768;

// Every byte becomes the character with the same code (U+0000-U+00FF), which is the text the
// stored message holds. TextDecoder("latin1") is windows-1252 and would change 0x80-0x9F.
const bytesToText = (bytes: Uint8Array) => {
  const parts: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += CHAR_CODE_CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(offset, offset + CHAR_CODE_CHUNK)));
  }
  return parts.join("");
};

const NOTICE_CLASS = "p-5 text-sm italic text-muted-foreground";

export const EmailUsageDetails = ({ id }: { id: string }) => {
  const { t } = useT("os.communication.mail");
  const { data: details, isLoading } = useGetEmailUsageById(id);
  const [view, setView] = useState<BodyView | null>(null);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [downloadingEml, setDownloadingEml] = useState(false);
  const fetchSource = useFetchEmailUsageSource(id);

  const downloadAttachment = async (index: number, attachment: IMailBoxMailAttachment) => {
    setDownloadingIndex(index);
    try {
      // The route id names the mail row; the file endpoint resolves it like the details read.
      const blob = await emailService.getMailBoxMailAttachmentFile(id, index);
      saveBlob(
        new Blob([blob], { type: attachment.contentType || "application/octet-stream" }),
        attachment.fileName,
      );
    } catch {
      toast({
        variant: "destructive",
        title: t("EMAIL_USAGE_DETAILS.DOWNLOAD_FAILED_TITLE"),
        description: t("EMAIL_USAGE_DETAILS.DOWNLOAD_FAILED_DESCRIPTION", {
          name: attachment.fileName,
        }),
      });
    } finally {
      setDownloadingIndex(null);
    }
  };

  const downloadEml = async (subject: string) => {
    setDownloadingEml(true);
    try {
      const bytes = await fetchSource();
      saveBlob(new Blob([bytes], { type: "message/rfc822" }), emlFileName(subject));
    } catch {
      // The failure lands on the shared source query, whose effect below shows the toast once,
      // also when this click joined a request the Original view had already started.
    } finally {
      setDownloadingEml(false);
    }
  };

  const bodies = useMemo(() => {
    const content = details?.content;
    const body = details?.body || "";
    const html = content?.htmlBody || (looksLikeHtml(body) ? body : "");
    const text = content?.textBody || (!looksLikeHtml(body) ? body : "");
    // A mail that is only an attachment still carries a line break as its body; that is not
    // something worth a tab of its own.
    return { html: html.trim() ? html : "", text: text.trim() ? text : "" };
  }, [details]);

  const content = details?.content;
  const tooLarge = !!content?.previewTooLarge;
  const hasSource = (content?.rawMimeLength ?? 0) > 0;
  const availableViews: BodyView[] = tooLarge
    ? []
    : [
        ...(bodies.html ? (["html"] as const) : []),
        ...(bodies.text ? (["text"] as const) : []),
        ...(hasSource ? (["source"] as const) : []),
      ];
  const activeView = view && availableViews.includes(view) ? view : availableViews[0];

  const source = useGetEmailUsageSource(id, activeView === "source");
  const sourceText = useMemo(() => (source.data ? bytesToText(source.data) : ""), [source.data]);

  // One toast per failed source request, whether the Original view or the `.eml` button made it.
  // A failure already in the cache when a message opens is not announced again.
  const toastedSourceErrors = useRef({ id, count: source.errorUpdateCount });
  useEffect(() => {
    const seen = toastedSourceErrors.current;
    toastedSourceErrors.current = { id, count: source.errorUpdateCount };
    if (seen.id !== id || source.errorUpdateCount <= seen.count) return;
    toast({
      variant: "destructive",
      title: t("EMAIL_USAGE_DETAILS.DOWNLOAD_FAILED_TITLE"),
      description: t("EMAIL_USAGE_DETAILS.SOURCE_FAILED_DESCRIPTION"),
    });
  }, [id, source.errorUpdateCount, t]);

  if (isLoading) return <EmailUsageDetailsSkeleton />;
  if (!details) {
    return (
      <Card className="mt-6">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
          <Mail className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">{t("EMAIL_USAGE_DETAILS.NOT_FOUND_TITLE")}</p>
          <p className="text-sm text-muted-foreground">
            {t("EMAIL_USAGE_DETAILS.NOT_FOUND_DESCRIPTION")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const sender = parseAddress(details.from);
  const attachments = tooLarge ? [] : (content?.attachments ?? []);

  return (
    <main className="flex flex-col gap-6">
      <div className="hidden md:flex">
        <EmailUsageDetailsBreadcrumb id={details.messageId || id} isInbound={details.isInbound} />
      </div>

      <Card className="mt-2 shadow-none">
        <CardContent className="space-y-5 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <h1 className="wrap-break-word text-lg font-semibold text-high-emphasis md:text-2xl">
              {details.subject || (
                <span className="italic text-muted-foreground">
                  {t("EMAIL_USAGE_DETAILS.NO_SUBJECT")}
                </span>
              )}
            </h1>
            <div className="flex shrink-0 items-center gap-2">
              {!details.isInbound && <StatusBadge status={details.status} />}
              {hasSource && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloadingEml}
                  onClick={() => downloadEml(details.subject)}
                >
                  {downloadingEml ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {t("EMAIL_USAGE_DETAILS.DOWNLOAD_EML")}
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
                  title={
                    details.isInbound
                      ? t("EMAIL_USAGE_DETAILS.RECEIVED")
                      : t("EMAIL_USAGE_DETAILS.SENT")
                  }
                >
                  {details.date ? formatMailDateLong(details.date) : "-"}
                </p>
              </div>
              <AddressLine label={t("EMAIL_USAGE_DETAILS.LABEL_TO")} raw={details.to} />
              <AddressLine label={t("EMAIL_USAGE_DETAILS.LABEL_CC")} raw={content?.cc} />
              <AddressLine label={t("EMAIL_USAGE_DETAILS.LABEL_REPLY_TO")} raw={content?.replyTo} />
            </div>
          </div>

          {details.error && (
            <div className="flex items-start gap-2 rounded-md border border-error/30 bg-error/5 p-3 text-sm text-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="wrap-break-word">{details.error}</span>
            </div>
          )}

          {attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("EMAIL_USAGE_DETAILS.ATTACHMENTS", { count: attachments.length })}
              </p>
              <div className="flex flex-wrap gap-2">
                {attachments.map((attachment, index) => (
                  <button
                    type="button"
                    key={`${attachment.fileName}-${index}`}
                    className="group flex max-w-xs items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    title={t("EMAIL_USAGE_DETAILS.DOWNLOAD_ATTACHMENT", {
                      name: attachment.fileName,
                    })}
                    aria-label={t("EMAIL_USAGE_DETAILS.DOWNLOAD_ATTACHMENT", {
                      name: attachment.fileName,
                    })}
                    disabled={downloadingIndex === index}
                    onClick={() => downloadAttachment(index, attachment)}
                  >
                    {downloadingIndex === index ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate text-sm">{attachment.fileName}</span>
                    {attachment.size != null && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatSize(attachment.size)}
                      </span>
                    )}
                    <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden shadow-none">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <p className="text-sm font-medium text-high-emphasis">
            {t("EMAIL_USAGE_DETAILS.MESSAGE")}
          </p>
          {availableViews.length > 1 && (
            <Tabs value={activeView} onValueChange={(value) => setView(value as BodyView)}>
              <TabsList className="h-8">
                {availableViews.includes("html") && (
                  <TabsTrigger value="html" className="h-6 px-3 text-xs">
                    {t("EMAIL_USAGE_DETAILS.VIEW_FORMATTED")}
                  </TabsTrigger>
                )}
                {availableViews.includes("text") && (
                  <TabsTrigger value="text" className="h-6 px-3 text-xs">
                    {t("EMAIL_USAGE_DETAILS.VIEW_PLAIN_TEXT")}
                  </TabsTrigger>
                )}
                {availableViews.includes("source") && (
                  <TabsTrigger value="source" className="h-6 px-3 text-xs">
                    {t("EMAIL_USAGE_DETAILS.VIEW_ORIGINAL")}
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
              title={t("EMAIL_USAGE_DETAILS.BODY_FRAME_TITLE")}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              srcDoc={buildMailFrameDocument(bodies.html)}
              className="block h-[70vh] w-full border-0 bg-white"
            />
          )}
          {activeView === "text" && (
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap wrap-break-word p-5 font-sans text-sm leading-relaxed text-high-emphasis">
              {bodies.text}
            </pre>
          )}
          {activeView === "source" &&
            (source.data ? (
              <pre className="max-h-[70vh] overflow-auto whitespace-pre p-5 font-mono text-xs leading-relaxed text-muted-foreground">
                {sourceText}
              </pre>
            ) : source.isError ? (
              <p className={NOTICE_CLASS}>{t("EMAIL_USAGE_DETAILS.SOURCE_FAILED_DESCRIPTION")}</p>
            ) : (
              <div className="p-5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ))}
          {tooLarge && (
            <p className={NOTICE_CLASS}>{t("EMAIL_USAGE_DETAILS.TOO_LARGE_TO_PREVIEW")}</p>
          )}
          {!activeView && !tooLarge && (
            <p className={NOTICE_CLASS}>{t("EMAIL_USAGE_DETAILS.NO_BODY")}</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};
