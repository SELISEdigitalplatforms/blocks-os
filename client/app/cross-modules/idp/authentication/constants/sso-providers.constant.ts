const Google = "/assets/images/social-media-google.png";
const Microsoft = "/assets/images/social-media-ms.png";
// const GithubDark = "/assets/images/github-dark-mode.png";
// const Github = "/assets/images/social-media-github.png";
// const LinkedIn = "/assets/images/social-media-in.png";
// const AppleDark = "/assets/images/apple-dark-mode-logo.png";
// const Apple = "/assets/images/social-media-apple.png";
// const Facebook = "/assets/images/social-media-facebook.png";
// const Selise = "/assets/images/selise-globe-logo.png";
// const XDark = "/assets/images/twitter-x-dark-mode-logo.png";
// const X = "/assets/images/twitter-x-light-mode-logo.png";
import { tStatic } from "@seliseblocks/genesis-os";
import {
  ISsoProviderConfigurationWithMeta,
  ISsoProviderFrontendMeta,
} from "@blocks-idp/authentication/models/sso.model";

const KEY_HELP_TITLE = "SSO_PROVIDERS_CONSTANT.HELP_TITLE";

const I18N_MODULE = "os.idp.auth";

/**
 * Identifiers for the single sign-on providers supported by the platform.
 * The string values are persisted in configuration documents and exchanged
 * with backend services as the canonical provider key.
 */
export enum SSO_PROVIDERS {
  /** Google (OAuth 2.0 / OpenID Connect). */
  google = "google",
  /** Microsoft Entra ID / Azure AD (OAuth 2.0 / OpenID Connect). */
  microsoft = "microsoft",
  /** GitHub OAuth Apps. */
  github = "github",
  /** LinkedIn Sign In (OAuth 2.0). */
  linkedin = "linkedin",
  /** X (formerly Twitter) OAuth 2.0 with PKCE. */
  x = "x",
  /** Sign in with Apple. */
  apple = "apple",
  /** Facebook Login (OAuth 2.0). */
  facebook = "facebook",
  /** "Bring your own SSO" generic OIDC provider slot. */
  ownsso = "ownsso",
}

/** Shared empty defaults for all provider configuration fields. */
const PROVIDER_DEFAULTS: Omit<
  ISsoProviderConfigurationWithMeta,
  keyof ISsoProviderFrontendMeta | "provider"
> = {
  itemId: "",
  createdDate: "",
  lastUpdatedDate: "",
  createdBy: "",
  lastUpdatedBy: "",
  language: "en",
  organizationIds: [],
  tags: [],
  audience: "",
  clientId: "",
  clientSecret: "",
  authorizationUrl: "",
  tokenUrl: "",
  getProfileUrl: "",
  redirectUrl: "",
  scope: [],
  initialRoles: [],
  initialPermissions: [],
  isDisabled: false,
  userRoles: [],
  userPermissions: [],
};

/**
 * Creates a fully-typed provider config by merging shared defaults with
 * provider-specific metadata. Eliminates the ~20-field boilerplate per entry.
 */
function createProviderConfig(
  provider: SSO_PROVIDERS,
  meta: ISsoProviderFrontendMeta,
): ISsoProviderConfigurationWithMeta {
  // Copy property descriptors, not values: the copy, help and label fields are getters that
  // translate when read, so a spread would freeze them at import time.
  return Object.defineProperties(
    { ...PROVIDER_DEFAULTS, provider } as ISsoProviderConfigurationWithMeta,
    Object.getOwnPropertyDescriptors(meta),
  );
}

export const SOCIAL_AUTH_PROVIDERS_CONFIG: Partial<
  Record<SSO_PROVIDERS, ISsoProviderConfigurationWithMeta>
> = {
  // github: createProviderConfig(SSO_PROVIDERS.github, {
  //   label: "GitHub",
  //   description: "Enable the GitHub login option for your Auth0 applications",
  //   imageSrc: Github,
  //   imageSrcDark: GithubDark,
  //   isAvailable: true,
  //   isConfigured: false,
  // }),
  google: createProviderConfig(SSO_PROVIDERS.google, {
    label: "Google",
    get description() {
      return tStatic(I18N_MODULE, "SSO_PROVIDERS_CONSTANT.GOOGLE_DESCRIPTION");
    },
    imageSrc: Google,
    isAvailable: true,
    isConfigured: false,
    get helpTitle() {
      return tStatic(I18N_MODULE, KEY_HELP_TITLE);
    },
    get helpBody() {
      return tStatic(I18N_MODULE, "SSO_PROVIDERS_CONSTANT.GOOGLE_HELP_BODY");
    },
  }),
  microsoft: createProviderConfig(SSO_PROVIDERS.microsoft, {
    label: "Microsoft",
    get description() {
      return tStatic(I18N_MODULE, "SSO_PROVIDERS_CONSTANT.MICROSOFT_DESCRIPTION");
    },
    imageSrc: Microsoft,
    isAvailable: true,
    isConfigured: false,
    get helpTitle() {
      return tStatic(I18N_MODULE, KEY_HELP_TITLE);
    },
    get helpBody() {
      return tStatic(I18N_MODULE, "SSO_PROVIDERS_CONSTANT.MICROSOFT_HELP_BODY");
    },
  }),
  // linkedin: createProviderConfig(SSO_PROVIDERS.linkedin, {
  //   label: "LinkedIn",
  //   description:
  //     "Leverage the largest professional social network to enhance your sign-in experience",
  //   imageSrc: LinkedIn,
  //   isAvailable: true,
  //   isConfigured: false,
  // }),
  // x: createProviderConfig(SSO_PROVIDERS.x, {
  //   label: "X",
  //   description: "Twitter allows users to enjoy the benefits of login with as little as one...",
  //   imageSrc: X,
  //   imageSrcDark: XDark,
  //   isAvailable: true,
  //   isConfigured: false,
  // }),
  // apple: createProviderConfig(SSO_PROVIDERS.apple, {
  //   label: "Apple",
  //   description: "The easy way to add Sign in with Apple to your app or website",
  //   imageSrc: Apple,
  //   imageSrcDark: AppleDark,
  //   isAvailable: true,
  //   isConfigured: false,
  // }),
  // facebook: createProviderConfig(SSO_PROVIDERS.facebook, {
  //   label: "Facebook",
  //   description: "A fast and convenient way for users to log into your app with Facebook",
  //   imageSrc: Facebook,
  //   isAvailable: false,
  //   isConfigured: false,
  // }),
  ownsso: createProviderConfig(SSO_PROVIDERS.ownsso, {
    get label() {
      return tStatic(I18N_MODULE, "SSO_PROVIDERS_CONSTANT.OWNSSO_LABEL");
    },
    get description() {
      return tStatic(I18N_MODULE, "SSO_PROVIDERS_CONSTANT.OWNSSO_DESCRIPTION");
    },
    imageSrc: "",
    isAvailable: false,
    isConfigured: false,
  }),
};

/**
 * Contextual "Where do I find these?" help copy for the "Add Identity Provider" dialog.
 * Blocks OIDC and Bring-your-own-SSO aren't social providers, so their help copy lives here
 * rather than in `SOCIAL_AUTH_PROVIDERS_CONFIG`.
 */
export const BLOCKS_OIDC_HELP: { title: string; body: string } = {
  get title() {
    return tStatic(I18N_MODULE, KEY_HELP_TITLE);
  },
  get body() {
    return tStatic(I18N_MODULE, "SSO_PROVIDERS_CONSTANT.BLOCKS_OIDC_HELP_BODY");
  },
};

export const BYOS_HELP: { title: string; body: string } = {
  get title() {
    return tStatic(I18N_MODULE, KEY_HELP_TITLE);
  },
  get body() {
    return tStatic(I18N_MODULE, "SSO_PROVIDERS_CONSTANT.BYOS_HELP_BODY");
  },
};
