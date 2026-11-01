import { useState } from "react";
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
import { Label } from "@/components/ui-kits/label/label";
import { PasswordInput } from "@/components/password-input/password-input";
import { useRotateSecret } from "@/cross-modules/secrets/hooks/use-secret-management";
import { describeSecretError } from "@/cross-modules/secrets/utils/secret-error";
import { type SecretResult } from "@/cross-modules/secrets/models/secret.model";
import { useT, tStatic } from "@seliseblocks/genesis-os";

interface RotateSecretModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secret: SecretResult;
}

/**
 * Replaces a secret's value.
 *
 * The new value is typed or pasted by the user. Generating one client-side would mean the
 * browser inventing a credential the consuming system has never agreed to — the reference
 * mock-up does it, and it is deliberately not carried over.
 *
 * Mount this only while it is open; a fresh mount is what clears the entered value.
 */
export function RotateSecretModal({ open, onOpenChange, secret }: RotateSecretModalProps) {
  const { t } = useT("os.secrets");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { mutateAsync: rotate, isPending } = useRotateSecret();

  // No client-side length check: the 25 KB vault cap is enforced server-side and comes back as
  // a 400 the catch below surfaces.
  const canSubmit = confirmed && value.length > 0 && !isPending;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await rotate({ secretId: secret.secretId, value });
      onOpenChange(false);
    } catch (cause) {
      setError(
        describeSecretError(
          cause,
          tStatic("os.secrets", "ROTATE_SECRET_MODAL.COULD_NOT_ROTATE_THE_SECRET"),
        ).message,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">
            {t("ROTATE_SECRET_MODAL.ROTATE", { name: secret.name })}
          </DialogTitle>
          <DialogDescription className="text-left">
            {t("ROTATE_SECRET_MODAL.THE_OLD_VALUE_IS_REPLACED")}
          </DialogDescription>
        </DialogHeader>

        <Banner variant="warning">{t("ROTATE_SECRET_MODAL.ANYTHING_STILL_USING_THE_OLD")}</Banner>

        {error && <Banner variant="destructive">{error}</Banner>}

        {!confirmed ? (
          <p className="text-sm text-muted-foreground">
            {t("ROTATE_SECRET_MODAL.CONFIRM_YOU_WANT_TO_ROTATE")}
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="rotate-secret-value">
              {t("ROTATE_SECRET_MODAL.NEW_VALUE", { span: "*" })}
            </Label>
            <PasswordInput
              id="rotate-secret-value"
              placeholder={t("ROTATE_SECRET_MODAL.PASTE_THE_NEW_SECRET_VALUE")}
              autoComplete="off"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("ROTATE_SECRET_MODAL.CONSUMERS_KEEP_USING_THE_OLD")}
            </p>
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("common:CANCEL")}
          </Button>
          {!confirmed ? (
            <Button type="button" onClick={() => setConfirmed(true)}>
              {t("common:CONTINUE")}
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={!canSubmit}>
              {isPending ? t("ROTATE_SECRET_MODAL.ROTATING") : t("ROTATE_SECRET_MODAL.ROTATE_2")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
