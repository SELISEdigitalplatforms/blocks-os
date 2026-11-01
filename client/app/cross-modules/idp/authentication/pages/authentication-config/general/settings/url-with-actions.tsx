import { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import { Check, Copy, Download } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";

interface UrlWithActionsProps {
  url: string;
  className?: string;
}

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
};

export const UrlWithActions = ({ url, className }: UrlWithActionsProps) => {
  const { t } = useT("os.idp.auth");
  const [isCopying, setIsCopying] = useState(false);
  const certificatePath = url.trim();

  if (!certificatePath) {
    return (
      <span className="text-sm text-muted-foreground">{t("URL_WITH_ACTIONS.NO_CERTIFICATE")}</span>
    );
  }

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    try {
      event.preventDefault();
      event.stopPropagation();
      if (isCopying) return;
      setIsCopying(true);
      await copyTextToClipboard(certificatePath);
    } catch (err) {
      console.error("Failed to copy:", err);
      setIsCopying(false);
    } finally {
      setTimeout(() => {
        setIsCopying(false);
      }, 1000);
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(certificatePath);
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = certificatePath.split("/").pop() || "certificate.pem";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Failed to download:", err);
    }
  };

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <a
        href={certificatePath}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-high-emphasis underline"
        title={certificatePath}
      >
        {t("URL_WITH_ACTIONS.PUBLIC_CERTIFICATE")}
      </a>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          className="h-auto p-1 transition-colors hover:bg-gray-100"
          onClick={handleCopy}
          type="button"
          title={isCopying ? t("URL_WITH_ACTIONS.COPIED") : t("URL_WITH_ACTIONS.COPY_URL")}
          aria-label={isCopying ? t("common:COPIED") : t("URL_WITH_ACTIONS.COPY_CERTIFICATE_URL")}
        >
          {isCopying ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : (
            <Copy className="h-4 w-4 text-gray-600 hover:text-gray-800" />
          )}
        </Button>
        <Button
          variant="ghost"
          className="h-auto p-1 transition-colors hover:bg-gray-100"
          onClick={handleDownload}
          type="button"
          title={t("URL_WITH_ACTIONS.DOWNLOAD_CERTIFICATE")}
          aria-label={t("URL_WITH_ACTIONS.DOWNLOAD_CERTIFICATE")}
        >
          <Download className="h-4 w-4 text-gray-600 hover:text-gray-800" />
        </Button>
      </div>
    </div>
  );
};
