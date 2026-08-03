import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { useGeneratePats } from "@blocks-idp/iam/security/hooks/use-generate-pats";
import type { IGeneratePATPayload, IPATApi } from "@blocks-idp/iam/security/api";
import { getRuntimeEnv } from "@/lib/runtime-env";

interface GenerateTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  id: string;
  onSuccess?: (data: IPATApi) => void;
}

export function GenerateTokenModal({ isOpen, onClose, onSuccess }: GenerateTokenModalProps) {
  const [note, setNote] = useState("");
  const [expiration, setExpiration] = useState("30");

  const { mutate: generateToken, isPending, isError } = useGeneratePats();

  const getExpirationDate = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getExpirationLabel = (days: string): string => {
    const daysNum = parseInt(days);
    return `${days} days (${getExpirationDate(daysNum)})`;
  };

  const handleGenerate = () => {
    if (!note.trim()) {
      return;
    }

    const expirationDays = parseInt(expiration);

    // The IAM source hard-codes a client id per SELISE cloud environment. OS
    // already resolves the IAM OIDC client id from the environment, so read it
    // from there instead of shipping environment-specific ids in source.
    const payload: IGeneratePATPayload = {
      clientId: getRuntimeEnv("BLOCKS_IAM_CLIENT_ID") || "",
      note: note || undefined,
      codeTtlInMinute: expirationDays * 24 * 60,
    };

    generateToken(payload, {
      onSuccess: (data) => {
        setNote("");
        setExpiration("30");

        const first = Array.isArray(data) ? data[0] : data;
        if (first) onSuccess?.(first);

        onClose();
      },
    });
  };

  const handleCancel = () => {
    onClose();
    setNote("");
    setExpiration("30");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleCancel();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Generate Token</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            Create a secure access token for authentication and API use.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isError && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              <p className="text-sm">Failed to generate token. Please try again.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-medium">
              PAT Name <span className="text-error">*</span>
            </Label>
            <Input
              id="note"
              placeholder="Write here ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full"
              disabled={isPending}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiration" className="text-sm font-medium">
              Expiration
            </Label>
            <Select value={expiration} onValueChange={setExpiration} disabled={isPending}>
              <SelectTrigger className="w-full">
                <SelectValue>{getExpirationLabel(expiration)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days ({getExpirationDate(30)})</SelectItem>
                <SelectItem value="15">15 days ({getExpirationDate(15)})</SelectItem>
                <SelectItem value="7">7 days ({getExpirationDate(7)})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex gap-3 sm:gap-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1 sm:flex-none"
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            className="flex-1 sm:flex-none"
            disabled={isPending || !note.trim()}
          >
            {isPending ? "Generating..." : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
