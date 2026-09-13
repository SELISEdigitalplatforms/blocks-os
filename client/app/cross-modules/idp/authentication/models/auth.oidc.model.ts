export interface IGetOidcPayload {
  projectKey: string;
  clientId?: string;
}

export interface IOidcConfig {
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  language: string;
  lastUpdatedBy: string;
  organizationIds: string[];
  tags: string[];
  clientSecret: string;
  redirectUris?: string[];
  redirectUri?: string;
  scope: string;
  audience: string;
  isAutoRedirect: boolean;
  isActive: boolean;
  requirePkce: boolean;
  registerAsIdentityProvider?: boolean;
  isDeviceFlowClient?: boolean;
  allowedResponseTypes: string[];
  allowedServiceAccessResources?: string[];
  tenantId: string;
  clientDisplayName: string;
}
export interface IGetOidcCredentialsResponse {
  oIDCClientCredentials: IOidcConfig[];
  errors: Record<string, string> | null;
  isSuccess: boolean;
}

export interface ISaveOidcCredentialPayload {
  isAutoRedirect: boolean;
  isActive: boolean;
  itemId: string;
  redirectUris: string[];
  scope: string;
  requirePkce: boolean;
  registerAsIdentityProvider: boolean;
  isDeviceFlowClient: boolean;
  externalDiscoveryEndpoint?: string;
  allowedResponseTypes: string[];
  allowedServiceAccessResources?: string[];
  clientDisplayName: string;
}

export interface ISaveOidcCredentialResponse {
  audience: string;
  isAutoRedirect: boolean;
  isActive: boolean;
  itemId: string;
  projectKey: string;
  redirectUris: string[];
  scope: string;
  requirePkce: boolean;
  isDeviceFlowClient: boolean;
  allowedResponseTypes: string[];
  allowedServiceAccessResources?: string[];
  clientDisplayName: string;
}

export interface IOidcUiThemePalette {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  success: string;
  danger: string;
  border: string;
  borderStrong: string;
  accentSoft: string;
}

export interface IOidcUiTemplate {
  branding: {
    logoUrl: string | null;
    brandName: string;
  };
  theme: {
    light: IOidcUiThemePalette;
    dark: IOidcUiThemePalette;
  };
  pages: {
    login: {
      heading: string;
      emailLabel: string;
      passwordLabel: string;
      forgotPasswordLink: string;
      submitButton: string;
      signupPrompt: string;
      signupLink: string;
      ssoSeparatorText: string;
      activationErrorTitle: string;
      activationErrorMessage: string;
      activateAccountButton: string;
      backToLoginButton: string;
    };
    signup: {
      heading: string;
      firstNameLabel: string;
      lastNameLabel: string;
      emailLabel: string;
      organizationNameLabel: string;
      submitButton: string;
      creatingButton: string;
      termsPrefix: string;
      termsLinkText: string;
      privacyLinkText: string;
      termsConjunction: string;
      loginPrompt: string;
      loginLink: string;
      ssoSeparatorText: string;
      successTitle: string;
      successSubtitle: string;
      emailSentTitle: string;
      emailSentSubtitle: string;
      resendPromptTitle: string;
      resendPromptSubtitle: string;
      resendButton: string;
      loginSentPrompt: string;
      loginSentLink: string;
    };
    forgotPassword: {
      heading: string;
      introText: string;
      emailLabel: string;
      submitButton: string;
      backToLoginButton: string;
      successTitle: string;
      successSubtitle: string;
      resendPromptTitle: string;
      resendPromptSubtitle: string;
      resendButton: string;
      loginPrompt: string;
      loginLink: string;
    };
    resetPassword: {
      heading: string;
      passwordLabel: string;
      confirmPasswordLabel: string;
      logoutFromDevicesLabel: string;
      submitButton: string;
      resettingButton: string;
      missingCodeMessage: string;
      requestNewLinkButton: string;
      backToLoginButton: string;
      successTitle: string;
      successSubtitle: string;
      readyTitle: string;
      readySubtitle: string;
      loginButton: string;
    };
    activation: {
      heading: string;
      firstNameLabel: string;
      lastNameLabel: string;
      passwordLabel: string;
      confirmPasswordLabel: string;
      submitButton: string;
      activatingButton: string;
      successTitle: string;
      successSubtitle: string;
      invalidHeading: string;
      invalidMessage: string;
      expiredHeading: string;
      expiredMessage: string;
      alreadyActiveHeading: string;
      alreadyActiveMessage: string;
      resendButton: string;
      resendSuccessMessage: string;
      resendFailureMessage: string;
      autoConfirmCaptchaText: string;
      autoConfirmProgressText: string;
      autoActivatingLabel: string;
      readyTitle: string;
      readyWithPasswordSubtitle: string;
      readySubtitle: string;
      loginButton: string;
      backToLoginButton: string;
    };
    mfa: {
      heading: string;
      submitButton: string;
      resendButton: string | null;
    };
    accountSelector: {
      heading: string;
      subheading: string | null;
      bodyText: string;
    };
    shared: {
      footerText: string;
      helpPrompt: string;
      supportLinkText: string;
    };
  };
}

export interface IGetOidcUiTemplateResponse {
  template: IOidcUiTemplate | null;
}

export interface ISaveOidcUiTemplateResponse {
  isSuccess: boolean;
  itemId?: string | null;
  errors?: Record<string, string>;
}

export interface IGetClientsPayload {
  projectKey: string;
}

export interface IClientCredentialsConfig {
  itemId: string;
  name: string;
  clientSecret: string;
  accessTokenValidForNumberMinutes: number;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  language: string;
  lastUpdatedBy: string;
  organizationId: string;
  tags: string[];
}

export interface ISaveClientCredentialPayload {
  itemId?: string | null;
  name: string;
  isActive: boolean;
  accessTokenValidForNumberMinutes: number;
  roles: string[];
  permissions: string[];
  projectKey: string;
  /**
   * The organization the credential is issued for. Sent on create only, and only when
   * multi-org is enabled — the server ignores it on update, because re-scoping a live
   * credential would change the reach of tokens running services already hold.
   */
  organizationId?: string;
}

export interface ISaveClientCredentialResponse {
  itemId: string;
  name: string;
  isActive: boolean;
  accessTokenValidForNumberMinutes: number;
  roles: string[];
  permissions: string[];
  isSuccess: boolean;
}

export interface TabValue {
  tabValue: string;
}
export interface IDeleteOidcClientPayload {
  itemId: string | null;
  projectKey: string;
}
export interface IDeleteOidcClientResponse {
  errors: {
    additionalProp1: string;
    additionalProp2: string;
    additionalProp3: string;
  };
  isSuccess: boolean;
}

export interface IRotateOidcClientSecretPayload {
  itemId: string;
  projectKey: string;
}

export interface IRotateOidcClientSecretResponse {
  isSuccess: boolean;
  itemId: string;
  clientId: string;
  clientSecret: string;
  rotatedAt: string;
  rotatedBy: string;
  errors?: Record<string, string>;
}
