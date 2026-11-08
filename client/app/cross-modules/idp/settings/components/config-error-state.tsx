import { useT } from "@seliseblocks/genesis-os";

type ConfigErrorStateProps = {
  message?: string;
};

export const ConfigErrorState = ({ message }: ConfigErrorStateProps) => {
  const { t } = useT("os.idp.settings");
  return (
    <p className="text-sm text-destructive" role="alert">
      {message ?? t("CONFIG_ERROR_STATE.MESSAGE")}
    </p>
  );
};
