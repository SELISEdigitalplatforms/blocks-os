import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Eye, EyeOff, Check } from "lucide-react";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { MaskedText } from "@/components/masked-text";
import { useRevealSecret } from "@/cross-modules/secrets/hooks/use-secret-management";
import { describeSecretError } from "@/cross-modules/secrets/utils/secret-error";
import type { SecretResult } from "@/cross-modules/secrets/models/secret.model";
import { useT, tStatic } from "@seliseblocks/genesis-os";

/** Closes the dialog after this long with no interaction, so a value cannot sit on screen. */
const AUTO_CLOSE_MS = 60_000;

interface RevealSecretModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secret: SecretResult;
}

/**
 * Shows a secret's plaintext value.
 *
 * The value is held in this component's state only. It is fetched through a mutation, never a
 * query — `useQuery` would put plaintext in the React Query cache and refetch it on window
 * focus, writing a `GetValue` audit row nobody asked for. State is cleared on close, and the
 * dialog closes itself after a minute of inactivity.
 */
export function RevealSecretModal({ open, onOpenChange, secret }: RevealSecretModalProps) {
  const { t } = useT("os.secrets");
  const [value, setValue] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { mutateAsync: reveal, isPending } = useRevealSecret();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearValue = useCallback(() => {
    setValue(null);
    setVisible(false);
    setError(null);
    setCopied(false);
  }, []);

  const close = useCallback(() => {
    clearValue();
    onOpenChange(false);
  }, [clearValue, onOpenChange]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(close, AUTO_CLOSE_MS);
  }, [close]);

  // One fetch per mount. Callers mount this only while it is open (see SecretRow), so the value
  // is fetched exactly once per deliberate click and disappears with the component. Fetching on
  // row expand "just in case" would fabricate audit entries for reads nobody asked for.
  useEffect(() => {
    let active = true;
    reveal(secret.secretId)
      .then((response) => {
        if (active) setValue(response.value);
      })
      .catch((cause) => {
        if (active) setError(describeSecretError(cause, tStatic("os.secrets", "REVEAL_SECRET_MODAL.COULD_NOT_READ_THE_SECRET")).message);
      });
    resetTimer();

    return () => {
      active = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // `reveal` is a stable mutate function; including it would double-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secret.secretId]);

  const copy = async () => {
    if (!value) return;
    resetTimer();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t("REVEAL_SECRET_MODAL.COULD_NOT_COPY_TO_THE"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent
        className="w-[calc(100vw-1.5rem)] max-w-lg sm:w-full"
        onMouseMove={resetTimer}
        onKeyDown={resetTimer}
      >
        <DialogHeader>
          <DialogTitle className="text-left">{secret.name}</DialogTitle>
          <DialogDescription className="text-left">
            {t("REVEAL_SECRET_MODAL.THIS_READ_HAS_BEEN_RECORDED")}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Banner variant="destructive">{error}</Banner>
        ) : (
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
            <div className="min-w-0 flex-1 break-all font-mono text-sm">
              {isPending || value === null ? (
                <span className="text-muted-foreground">{t("REVEAL_SECRET_MODAL.LOADING")}</span>
              ) : visible ? (
                <span data-testid="secret-value">{value}</span>
              ) : (
                <MaskedText text={value} length={Math.min(value.length, 48)} />
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={value === null}
                onClick={() => {
                  resetTimer();
                  setVisible((previous) => !previous);
                }}
                aria-label={visible ? t("REVEAL_SECRET_MODAL.HIDE_VALUE") : t("REVEAL_SECRET_MODAL.SHOW_VALUE")}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={value === null}
                onClick={copy}
                aria-label={t("REVEAL_SECRET_MODAL.COPY_VALUE")}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close}>
            {t("common:CLOSE")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
