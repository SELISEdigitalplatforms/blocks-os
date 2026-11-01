import { Badge } from "@/components/ui-kits/badge/badge";
import {
  isBrokenLinkedSecretStatus,
  type LinkedSecretStatus,
} from "@/cross-modules/secrets/models/secret.model";
import {
  IStorageConfiguration,
  getStorageSecretFields,
} from "@blocks-storage/models/storage.model";
import { useT, tStatic } from "@seliseblocks/genesis-os";

const STATUS_LABEL: Record<LinkedSecretStatus, string> = {
  get none() { return tStatic("os.storage", "STORAGE_SECRET_STATUS.NOT_SET"); },
  get active() { return tStatic("os.storage", "STORAGE_SECRET_STATUS.SET"); },
  get locked() { return tStatic("os.storage", "STORAGE_SECRET_STATUS.SET"); },
  get archived() { return tStatic("os.storage", "STORAGE_SECRET_STATUS.ARCHIVED"); },
  get missing() { return tStatic("os.storage", "STORAGE_SECRET_STATUS.MISSING"); },
  get unavailable() { return tStatic("os.storage", "STORAGE_SECRET_STATUS.STATUS_UNAVAILABLE"); },
};

/** Secrets can't be replaced on an update, so a broken one needs the configuration added again. */
const REPAIR_HINT = () => tStatic("os.storage", "STORAGE_SECRET_STATUS.DELETE_THIS_CONFIGURATION_AND_ADD");

function SecretStatusValue({ status }: Readonly<{ status?: LinkedSecretStatus }>) {
  if (isBrokenLinkedSecretStatus(status)) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Badge variant="warning">{STATUS_LABEL[status]}</Badge>
        <p className="text-right text-xs text-muted-foreground">{REPAIR_HINT()}</p>
      </div>
    );
  }

  return <span className="text-sm text-muted-foreground">{STATUS_LABEL[status ?? "none"]}</span>;
}

/** The provider's secrets with their status only: the server never returns a secret value. */
export function StorageSecretStatusList({ storage }: Readonly<{ storage: IStorageConfiguration }>) {
  const { t } = useT("os.storage");
  const fields = getStorageSecretFields()[storage.storageStrategy] ?? [];
  if (fields.length === 0) return null;

  return (
    <div>
      <div className="mb-2 text-xs text-muted-foreground">{t("STORAGE_SECRET_STATUS.SECRETS")}</div>
      <ul className="space-y-2">
        {fields.map(({ key, label }) => (
          <li key={key} className="flex items-start justify-between gap-4">
            <span className="text-sm font-medium">{label}</span>
            <SecretStatusValue status={storage[key]} />
          </li>
        ))}
      </ul>
    </div>
  );
}
