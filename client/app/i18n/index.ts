/**
 * i18n modules. English lives here (`<module>.en.json`); other languages come from the
 * localization service.
 *
 * - `os.actions` (25 keys): cross-modules/actions
 * - `os.ai` (115 keys): cross-modules/ai
 * - `os.ai-credits` (46 keys): cross-modules/ai-credits
 * - `os.api-settings` (24 keys): pages/api-settings
 * - `os.communication.mail` (330 keys): cross-modules/communication/mail
 * - `os.communication.notification` (372 keys): cross-modules/communication/notification
 * - `os.connect` (64 keys): pages/connect
 * - `os.create-project` (63 keys): pages/create-project, components/create-project, components/project-card, components/repository-selection-modal
 * - `os.dashboard` (172 keys): pages/dashboard
 * - `os.data-gateway` (40 keys): cross-modules/data-gateway
 * - `os.devops` (2 keys): cross-modules/devops
 * - `os.environments` (95 keys): pages/environments, components/environment-card, components/environment-migration
 * - `os.identifier` (70 keys): cross-modules/identifier
 * - `os.idp.api-settings` (21 keys): idp/api-settings
 * - `os.idp.auth` (295 keys): idp/authentication (rest)
 * - `os.idp.captcha` (43 keys): idp/captcha
 * - `os.idp.client-credentials` (87 keys): idp/authentication/components/(create-)client-credentials
 * - `os.idp.create-oidc` (84 keys): idp/authentication/components/create-oidc
 * - `os.idp.data-access` (12 keys): idp/data-access (root)
 * - `os.idp.explorer` (65 keys): idp/data-access/explorer
 * - `os.idp.gateway` (238 keys): idp/data-access/gateway
 * - `os.idp.iam` (52 keys): idp/iam (hooks, models, services, utils, constants, pages)
 * - `os.idp.iam-ui` (87 keys): idp/iam/components
 * - `os.idp.identity-provider` (98 keys): idp/authentication/components/identity-provider
 * - `os.idp.mfa` (21 keys): idp/mfa
 * - `os.idp.oidc` (217 keys): idp/authentication/components/oidc
 * - `os.idp.organizations` (91 keys): idp/iam/modules/organization-management
 * - `os.idp.permissions` (70 keys): idp/iam/modules/permission-management
 * - `os.idp.roles` (102 keys): idp/iam/modules/role-management
 * - `os.idp.rules` (192 keys): idp/data-access/rules
 * - `os.idp.security` (53 keys): idp/iam/security
 * - `os.idp.settings` (192 keys): idp/settings
 * - `os.idp.signup-links` (136 keys): idp/iam/modules/signup-link-management
 * - `os.idp.users` (316 keys): cross-modules/idp/iam/modules/user-management
 * - `os.integration` (61 keys): cross-modules/integration
 * - `os.integration-page` (8 keys): pages/integration
 * - `os.invitation` (16 keys): pages/invitation
 * - `os.lmt` (403 keys): cross-modules/lmt, pages/lmt
 * - `os.people` (111 keys): pages/people, components/people
 * - `os.repositories` (26 keys): pages/repositories
 * - `os.secret-management` (8 keys): pages/secret-management
 * - `os.secrets` (203 keys): cross-modules/secrets
 * - `os.settings` (24 keys): pages/settings
 * - `os.shared` (219 keys): components (except those listed under feature modules), hooks, layouts, lib, routes, constants (navigation, breadcrumb, environment options, lmt/secret/auth nav)
 * - `os.storage` (84 keys): cross-modules/storage
 * - `os.subscription-usage` (41 keys): pages/subscription-usage
 * - `os.utilities` (58 keys): cross-modules/utilities
 * - `os.webhooks` (104 keys): cross-modules/webhooks
 * Total: 5256 keys.
 */
import { registerTranslations } from "@seliseblocks/genesis-os";
import osActions from "./os.actions.en.json";
import osAi from "./os.ai.en.json";
import osAiCredits from "./os.ai-credits.en.json";
import osApiSettings from "./os.api-settings.en.json";
import osCommunicationMail from "./os.communication.mail.en.json";
import osCommunicationNotification from "./os.communication.notification.en.json";
import osConnect from "./os.connect.en.json";
import osCreateProject from "./os.create-project.en.json";
import osDashboard from "./os.dashboard.en.json";
import osDataGateway from "./os.data-gateway.en.json";
import osDevops from "./os.devops.en.json";
import osEnvironments from "./os.environments.en.json";
import osIdentifier from "./os.identifier.en.json";
import osIdpApiSettings from "./os.idp.api-settings.en.json";
import osIdpAuth from "./os.idp.auth.en.json";
import osIdpCaptcha from "./os.idp.captcha.en.json";
import osIdpClientCredentials from "./os.idp.client-credentials.en.json";
import osIdpCreateOidc from "./os.idp.create-oidc.en.json";
import osIdpDataAccess from "./os.idp.data-access.en.json";
import osIdpExplorer from "./os.idp.explorer.en.json";
import osIdpGateway from "./os.idp.gateway.en.json";
import osIdpIam from "./os.idp.iam.en.json";
import osIdpIamUi from "./os.idp.iam-ui.en.json";
import osIdpIdentityProvider from "./os.idp.identity-provider.en.json";
import osIdpMfa from "./os.idp.mfa.en.json";
import osIdpOidc from "./os.idp.oidc.en.json";
import osIdpOrganizations from "./os.idp.organizations.en.json";
import osIdpPermissions from "./os.idp.permissions.en.json";
import osIdpRoles from "./os.idp.roles.en.json";
import osIdpRules from "./os.idp.rules.en.json";
import osIdpSecurity from "./os.idp.security.en.json";
import osIdpSettings from "./os.idp.settings.en.json";
import osIdpSignupLinks from "./os.idp.signup-links.en.json";
import osIdpUsers from "./os.idp.users.en.json";
import osIntegration from "./os.integration.en.json";
import osIntegrationPage from "./os.integration-page.en.json";
import osInvitation from "./os.invitation.en.json";
import osLmt from "./os.lmt.en.json";
import osPeople from "./os.people.en.json";
import osRepositories from "./os.repositories.en.json";
import osSecretManagement from "./os.secret-management.en.json";
import osSecrets from "./os.secrets.en.json";
import osSettings from "./os.settings.en.json";
import osShared from "./os.shared.en.json";
import osStorage from "./os.storage.en.json";
import osSubscriptionUsage from "./os.subscription-usage.en.json";
import osUtilities from "./os.utilities.en.json";
import osWebhooks from "./os.webhooks.en.json";

registerTranslations("os.actions", osActions);
registerTranslations("os.ai", osAi);
registerTranslations("os.ai-credits", osAiCredits);
registerTranslations("os.api-settings", osApiSettings);
registerTranslations("os.communication.mail", osCommunicationMail);
registerTranslations("os.communication.notification", osCommunicationNotification);
registerTranslations("os.connect", osConnect);
registerTranslations("os.create-project", osCreateProject);
registerTranslations("os.dashboard", osDashboard);
registerTranslations("os.data-gateway", osDataGateway);
registerTranslations("os.devops", osDevops);
registerTranslations("os.environments", osEnvironments);
registerTranslations("os.identifier", osIdentifier);
registerTranslations("os.idp.api-settings", osIdpApiSettings);
registerTranslations("os.idp.auth", osIdpAuth);
registerTranslations("os.idp.captcha", osIdpCaptcha);
registerTranslations("os.idp.client-credentials", osIdpClientCredentials);
registerTranslations("os.idp.create-oidc", osIdpCreateOidc);
registerTranslations("os.idp.data-access", osIdpDataAccess);
registerTranslations("os.idp.explorer", osIdpExplorer);
registerTranslations("os.idp.gateway", osIdpGateway);
registerTranslations("os.idp.iam", osIdpIam);
registerTranslations("os.idp.iam-ui", osIdpIamUi);
registerTranslations("os.idp.identity-provider", osIdpIdentityProvider);
registerTranslations("os.idp.mfa", osIdpMfa);
registerTranslations("os.idp.oidc", osIdpOidc);
registerTranslations("os.idp.organizations", osIdpOrganizations);
registerTranslations("os.idp.permissions", osIdpPermissions);
registerTranslations("os.idp.roles", osIdpRoles);
registerTranslations("os.idp.rules", osIdpRules);
registerTranslations("os.idp.security", osIdpSecurity);
registerTranslations("os.idp.settings", osIdpSettings);
registerTranslations("os.idp.signup-links", osIdpSignupLinks);
registerTranslations("os.idp.users", osIdpUsers);
registerTranslations("os.integration", osIntegration);
registerTranslations("os.integration-page", osIntegrationPage);
registerTranslations("os.invitation", osInvitation);
registerTranslations("os.lmt", osLmt);
registerTranslations("os.people", osPeople);
registerTranslations("os.repositories", osRepositories);
registerTranslations("os.secret-management", osSecretManagement);
registerTranslations("os.secrets", osSecrets);
registerTranslations("os.settings", osSettings);
registerTranslations("os.shared", osShared);
registerTranslations("os.storage", osStorage);
registerTranslations("os.subscription-usage", osSubscriptionUsage);
registerTranslations("os.utilities", osUtilities);
registerTranslations("os.webhooks", osWebhooks);
