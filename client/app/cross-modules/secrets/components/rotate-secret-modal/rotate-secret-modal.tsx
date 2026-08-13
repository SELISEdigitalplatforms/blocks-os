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
import {
  SECRET_VALUE_MAX_BYTES,
  secretValueByteLength,
  type SecretResult,
} from "@/cross-modules/secrets/models/secret.model";

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
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const { mutateAsync: rotate, isPending } = useRotateSecret();

  const bytes = secretValueByteLength(value);
  const tooLarge = bytes > SECRET_VALUE_MAX_BYTES;
  const canSubmit = confirmed && value.length > 0 && !tooLarge && !isPending;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await rotate({ secretId: secret.secretId, value });
      onOpenChange(false);
    } catch (cause) {
      setError(describeSecretError(cause, "Could not rotate the secret.").message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-left">Rotate {secret.name}</DialogTitle>
          <DialogDescription className="text-left">
            The old value is replaced immediately.
          </DialogDescription>
        </DialogHeader>

        <Banner variant="warning">
          Anything still using the old value will start failing until it picks up the new one.
        </Banner>

        {error && <Banner variant="destructive">{error}</Banner>}

        {!confirmed ? (
          <p className="text-sm text-muted-foreground">
            Confirm you want to rotate this secret before entering a new value.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="rotate-secret-value">
              New value <span className="text-destructive">*</span>
            </Label>
            <PasswordInput
              id="rotate-secret-value"
              placeholder="Paste the new secret value"
              autoComplete="off"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
            <p className={tooLarge ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {tooLarge
                ? "The value is larger than the 25 KB limit."
                : `${(bytes / 1024).toFixed(1)} KB of ${SECRET_VALUE_MAX_BYTES / 1024} KB`}
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
            Cancel
          </Button>
          {!confirmed ? (
            <Button type="button" onClick={() => setConfirmed(true)}>
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={submit} disabled={!canSubmit}>
              {isPending ? "Rotating…" : "Rotate"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
