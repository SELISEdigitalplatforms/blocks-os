import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";

interface KVDetailItemProps {
  label: string;
  value: string;
  copyable?: boolean;
}

export const KVDetailItem = ({
  label,
  value,
  copyable = false,
}: KVDetailItemProps) => {
  const renderValue = () => {
    if (!value) {
      return <span className="italic text-muted-foreground">empty</span>;
    }

    if (!copyable) {
      return <span className="break-all text-high-emphasis">{value}</span>;
    }

    return (
      <CopyToClipboardButton textToCopy={value} isHoverable>
        <span className="break-all text-high-emphasis">{value}</span>
      </CopyToClipboardButton>
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-1 overflow-hidden sm:flex-row sm:items-start sm:gap-4">
      <span className="shrink-0 font-mono text-xs text-muted-foreground sm:w-44 md:w-56">
        {label}
      </span>
      <div className="min-w-0 flex-1 font-mono text-xs">{renderValue()}</div>
    </div>
  );
};
