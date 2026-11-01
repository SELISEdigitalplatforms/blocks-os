import { useCallback, useMemo, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { X } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
} from "@/components/ui-kits/drawer/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useT } from "@seliseblocks/genesis-os";
import { useSaveThirdPartyJwtProvider } from "@blocks-idp/authentication/hooks/use-third-party-jwt-provider";
import {
  toSavePayload,
  type ClaimsMapping,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

type ClaimField = keyof ClaimsMapping;

const CLAIM_FIELDS: { field: ClaimField; required?: boolean }[] = [
  { field: "userId", required: true },
  { field: "email" },
  { field: "userName" },
  { field: "name" },
  { field: "roles" },
];

/** Radix rejects an empty-string item value, so clearing a mapping needs a sentinel. */
const UNMAPPED = "__unmapped__";

/**
 * Claim names nest, and a namespaced claim is addressed by its path. Two levels covers the shapes
 * providers actually emit (Auth0 namespaced objects, Keycloak realm_access.roles) without turning
 * a large token into an unreadable list.
 */
function extractClaimPaths(payload: Record<string, unknown>, prefix = "", depth = 0): string[] {
  return Object.keys(payload).flatMap((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const value = payload[key];
    const isNested = value !== null && typeof value === "object" && !Array.isArray(value);

    return depth < 2 && isNested
      ? extractClaimPaths(value as Record<string, unknown>, path, depth + 1)
      : [path];
  });
}

type MapJwtClaimModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ThirdPartyJwtProvider | null;
};

/**
 * Maps a provider's claims by example: paste a token the provider actually issued, decode it, and
 * pick from the claims it carries. Typing claim names blind is how a mapping ends up naming a
 * claim the provider never sends, which then fails silently at sign-in rather than here.
 *
 * The mapping is stored on the provider itself, not alongside it: one row, one save.
 */
export function MapJwtClaimModal({
  open,
  onOpenChange,
  provider,
}: Readonly<MapJwtClaimModalProps>) {
  const { t } = useT("os.idp.auth");
  const claimFieldLabels: Record<ClaimField, string> = {
    userId: t("MAP_JWT_CLAIM_MODAL.FIELD_USER_ID"),
    email: t("common:EMAIL"),
    userName: t("MAP_JWT_CLAIM_MODAL.FIELD_USERNAME"),
    name: t("MAP_JWT_CLAIM_MODAL.FIELD_DISPLAY_NAME"),
    roles: t("MAP_JWT_CLAIM_MODAL.FIELD_ROLES"),
  };
  const { mutateAsync, isPending } = useSaveThirdPartyJwtProvider();

  const [token, setToken] = useState("");
  const [decodedClaims, setDecodedClaims] = useState<string[]>([]);
  const [decodeStatus, setDecodeStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [draft, setDraft] = useState<ClaimsMapping | null>(null);

  // Re-seed when a different provider is opened, without an effect: the drawer is mounted once and
  // reused, so the draft has to follow whichever provider it is showing.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = open ? (provider?.itemId ?? null) : null;

  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    setDraft(
      provider
        ? {
            userId: provider.claimsMapping?.userId ?? "",
            email: provider.claimsMapping?.email ?? "",
            userName: provider.claimsMapping?.userName ?? "",
            name: provider.claimsMapping?.name ?? "",
            roles: provider.claimsMapping?.roles ?? "",
          }
        : null,
    );
    setToken("");
    setDecodedClaims([]);
    setDecodeStatus(null);
  }

  // Before a token is decoded, the claims already mapped are the only ones we can offer — so an
  // existing mapping stays visible and editable rather than reading as empty.
  const options = useMemo(() => {
    const mapped = draft ? Object.values(draft).filter(Boolean) : [];
    return Array.from(new Set([...decodedClaims, ...mapped]));
  }, [decodedClaims, draft]);

  const fail = (message: string) => {
    setDecodeStatus({ ok: false, message });
    setDecodedClaims([]);
  };

  const decode = useCallback(() => {
    if (!token.trim()) {
      fail(t("MAP_JWT_CLAIM_MODAL.PASTE_FIRST"));
      return;
    }

    try {
      const claims = extractClaimPaths(jwtDecode<Record<string, unknown>>(token));

      if (!claims.length) {
        fail(t("MAP_JWT_CLAIM_MODAL.NO_CLAIMS"));
        return;
      }

      setDecodedClaims(claims);
      setDecodeStatus({
        ok: true,
        message: t("MAP_JWT_CLAIM_MODAL.DECODED", { count: claims.length }),
      });
      showSuccessToast({ description: t("MAP_JWT_CLAIM_MODAL.TOKEN_DECODED") });
    } catch {
      // The token is read for its claim names and nothing else — never verified, never trusted.
      fail(t("MAP_JWT_CLAIM_MODAL.UNREADABLE"));
    }
  }, [token, t]);

  const setField = (field: ClaimField, value: string) =>
    setDraft((prev) => (prev ? { ...prev, [field]: value === UNMAPPED ? "" : value } : prev));

  const save = async () => {
    if (!provider || !draft) return;

    const result = await mutateAsync(toSavePayload(provider, { claimsMapping: draft }));

    if (!result.isSuccess) {
      showErrorToast({
        errors: Object.values(result.errors ?? {}).join(" ") || t("MAP_JWT_CLAIM_MODAL.SAVE_FAILED"),
      });
      return;
    }

    showSuccessToast({ description: t("MAP_JWT_CLAIM_MODAL.SAVED", { name: provider.providerName }) });
    onOpenChange(false);
  };

  const hasClaimsToOffer = options.length > 0;

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange} handleOnly>
      <DrawerContent
        className={cn(
          "inset-y-0 left-auto right-0 mt-0 h-full w-full rounded-none border-l bg-background p-6 md:w-[672px] [&>div:first-child]:hidden",
          "transition-all duration-300 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        )}
        style={{ userSelect: "text" }}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DrawerTitle className="text-lg font-semibold leading-none tracking-tight">
                {t("MAP_JWT_CLAIM_MODAL.TITLE")}
              </DrawerTitle>
              {provider && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("MAP_JWT_CLAIM_MODAL.SUBTITLE", { key: provider.key })}
                </p>
              )}
            </div>
            <DrawerClose asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
                aria-label={t("MAP_JWT_CLAIM_MODAL.CLOSE_DRAWER")}
              >
                <X className="h-4 w-4" />
              </button>
            </DrawerClose>
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col space-y-6">
            <div className="space-y-3">
              <label htmlFor="jwt-sample" className="text-sm font-medium text-foreground">
                {t("MAP_JWT_CLAIM_MODAL.JWT_LABEL")}
              </label>
              <Textarea
                id="jwt-sample"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t("MAP_JWT_CLAIM_MODAL.JWT_PLACEHOLDER")}
                className="h-[142px] w-full resize-none rounded-md border px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {t("MAP_JWT_CLAIM_MODAL.PRIVACY_NOTE")}
              </p>
              {decodeStatus && (
                <p
                  role="status"
                  className={
                    decodeStatus.ok ? "text-sm text-emerald-600" : "text-sm text-destructive"
                  }
                >
                  {decodeStatus.message}
                </p>
              )}
              <Button type="button" onClick={decode} variant="outline" className="w-full sm:w-auto">
                {t("MAP_JWT_CLAIM_MODAL.DECODE")}
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col space-y-3">
              <p className="border-t pt-3 text-sm font-medium text-foreground">{t("MAP_JWT_CLAIM_MODAL.MAPPING_TABLE")}</p>

              {hasClaimsToOffer ? (
                <div className="flex-1 overflow-y-auto rounded-md">
                  <Table className="min-w-full text-sm">
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="w-1/2 text-left font-semibold text-foreground">
                          {t("MAP_JWT_CLAIM_MODAL.COLUMN_FIELD")}
                        </TableHead>
                        <TableHead className="w-1/2 text-left font-semibold text-foreground">
                          {t("MAP_JWT_CLAIM_MODAL.COLUMN_JWT_CLAIM")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {CLAIM_FIELDS.map(({ field, required }) => (
                        <TableRow key={field}>
                          <TableCell className="border-b py-2 text-foreground">
                            {claimFieldLabels[field]}
                            {required && <span className="ml-1 text-destructive">*</span>}
                          </TableCell>
                          <TableCell className="border-b py-2">
                            <Select
                              value={draft?.[field] || UNMAPPED}
                              onValueChange={(value) => setField(field, value)}
                            >
                              <SelectTrigger
                                aria-label={claimFieldLabels[field]}
                                className="border-0 text-foreground shadow-none focus:ring-0 focus:ring-offset-0"
                              >
                                <SelectValue placeholder={t("MAP_JWT_CLAIM_MODAL.NOT_MAPPED")} />
                              </SelectTrigger>
                              <SelectContent>
                                {!required && <SelectItem value={UNMAPPED}>{t("MAP_JWT_CLAIM_MODAL.NOT_MAPPED")}</SelectItem>}
                                {options.map((claim) => (
                                  <SelectItem key={claim} value={claim}>
                                    {claim}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="pt-3 text-xs text-muted-foreground">
                    {t("MAP_JWT_CLAIM_MODAL.USER_ID_NOTE")}
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center py-10">
                  <p className="text-sm text-muted-foreground">
                    {t("MAP_JWT_CLAIM_MODAL.EMPTY")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              {t("common:CANCEL")}
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={isPending || !draft?.userId}
              className="w-full sm:w-auto"
            >
              {isPending ? t("MAP_JWT_CLAIM_MODAL.SAVING") : t("common:SAVE")}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
