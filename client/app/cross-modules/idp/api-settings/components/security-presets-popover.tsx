import { Button } from "@/components/ui-kits/button/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { Shield, ShieldCheck, ShieldOff } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";

type SecurityPresetsPopoverProps = {
  onEnableAllMfa: () => void;
  onEnableAllCaptcha: () => void;
  onDisableAllMfa: () => void;
  onDisableAllCaptcha: () => void;
};

export const SecurityPresetsPopover = ({
  onEnableAllMfa,
  onEnableAllCaptcha,
  onDisableAllMfa,
  onDisableAllCaptcha,
}: SecurityPresetsPopoverProps) => {
  const { t } = useT("os.idp.api-settings");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 px-2 sm:px-3 font-medium">
          <Shield className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden lg:inline">{t("SECURITY_PRESETS_POPOVER.TITLE")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1.5">
        <button
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={onEnableAllMfa}
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-amber-500" />
          {t("SECURITY_PRESETS_POPOVER.ENABLE_ALL_MFA")}
        </button>
        <button
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={onDisableAllMfa}
        >
          <ShieldOff className="h-4 w-4 shrink-0 text-amber-500" />
          {t("SECURITY_PRESETS_POPOVER.DISABLE_ALL_MFA")}
        </button>
        <div className="my-1 h-px bg-border" />
        <button
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={onEnableAllCaptcha}
        >
          <Shield className="h-4 w-4 shrink-0 text-blue-500" />
          {t("SECURITY_PRESETS_POPOVER.ENABLE_ALL_CAPTCHA")}
        </button>
        <button
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={onDisableAllCaptcha}
        >
          <ShieldOff className="h-4 w-4 shrink-0 text-blue-500" />
          {t("SECURITY_PRESETS_POPOVER.DISABLE_ALL_CAPTCHA")}
        </button>
      </PopoverContent>
    </Popover>
  );
};