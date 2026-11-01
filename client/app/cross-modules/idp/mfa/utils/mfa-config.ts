import { Mail, Smartphone } from "lucide-react";
import { tStatic } from "@seliseblocks/genesis-os";

export const MFA_PROVIDER_DATA = [
  {
    provider: "email",
    get label() {
      return tStatic("os.idp.mfa", "MFA_CONFIG.EMAIL_LABEL");
    },
    Icon: Mail,
    status: false,
    type: 2,
    get description() {
      return tStatic("os.idp.mfa", "MFA_CONFIG.EMAIL_DESCRIPTION");
    },
  },
  {
    provider: "authenticator_app",
    get label() {
      return tStatic("os.idp.mfa", "MFA_CONFIG.AUTHENTICATOR_APP_LABEL");
    },
    Icon: Smartphone,
    status: false,
    type: 1,
    get description() {
      return tStatic("os.idp.mfa", "MFA_CONFIG.AUTHENTICATOR_APP_DESCRIPTION");
    },
  },
];
