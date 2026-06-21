import {
  AuthResolver,
  CallbackPage,
  ConsoleLayout,
  ConsolePage,
  DashboardLayout,
  DashboardOverview,
  EnvironmentsPage,
  LoginPage,
  ProfilePage,
  ProjectOverviewLayout,
  ProtectedGuard,
  PublicGuard,
} from "@seliseblocks/blocks-kit";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { navigationMenus } from "./constants/navigation-menus";
import { AIModels } from "./cross-modules/ai/pages/aimodels";
import { EmailConfigurationPage } from "./cross-modules/communication/mail";
import { NotificationConfigurationListPage } from "./cross-modules/communication/notification/components/notification-configuration-list";
import { SecretsList } from "./cross-modules/secrets/components/secrets-list/secrets-list";
import { StorageContents } from "./cross-modules/storage/pages/storage/storage-contents";
import { MagicUrls } from "./cross-modules/utilities/pages/magic-urls/magic-urls";
import { ClientCredentials } from "./idp/authentication/components/client-credentials";
import { IdentityProviderPage } from "./idp/authentication/components/identity-provider/identity-provider";
import { OIDC } from "./idp/authentication/components/oidc";
import OidcTemplate from "./idp/authentication/components/oidc/oidc-template";
import { AuthenticationConfigLayout } from "./idp/authentication/pages/authentication-config";
import { Certificates } from "./idp/authentication/pages/authentication-config/general/certificates/certificates";
import { SSO } from "./idp/authentication/pages/authentication-config/sso";
import { ConfigureCaptcha } from "./idp/captcha/pages/configure-captcha";
import { Permissions } from "./idp/iam/modules/permission-management";
import { Roles } from "./idp/iam/modules/role-management";
import { ConfigureMFA } from "./idp/mfa/pages/configure-mfa/configure-mfa";
import { CreateProjectWrapper } from "./pages/create-project/create-project";
import { EnvironmentMigrationPage } from "./pages/environments/environments";
import { InvitationConfirmPage } from "./pages/invitation/invitation-confirm-page";
import { InvitationResultPage } from "./pages/invitation/invitation-result-page";
import { PeopleManagement } from "./pages/people/people-management";
import { PersonDetailPage } from "./pages/people/person-detail-page";
import { RepositoriesPage } from "./pages/repositories/repositories";
import { SettingsPage } from "./pages/settings/settings";
import { SubscriptionUsagePage } from "./pages/subscription-usage/subscription-usage-page";
import ActivatePage from "./routes/auth/activate-page";
import GitHubCallbackPage from "./routes/callback/callback";
import AiModelSelectedRoute from "./routes/dashboard/ai-model-selected";
import ApiSettingsPage from "./routes/dashboard/api-settings";
import IamPage from "./routes/dashboard/iam";
import IamAddPermissionPage from "./routes/dashboard/iam-add-permission";
import IamConfigurePage from "./routes/dashboard/iam-configure";
import IamOrgDetailPage from "./routes/dashboard/iam-org-detail";
import IamPermissionDetailPage from "./routes/dashboard/iam-permission-detail";
import IamRoleDetailPage from "./routes/dashboard/iam-role-detail";
import LmtPage from "./routes/dashboard/lmt";
import LmtTraceDetailsRedirect from "./routes/dashboard/lmt-trace-details";
import MagicUrlDetailsPage from "./routes/dashboard/magic-url-details";
import ManagedServicesPage from "./routes/dashboard/managed-services";
import RateLimiterPage from "./routes/dashboard/rate-limiter";
import SecretManagementLayout from "./routes/dashboard/secret-management";
import SsoConfigurationPage from "./routes/dashboard/sso-configuration";
import { LogsRoute } from "./pages/lmt/logs";
import { LmtServiceLogsRoute } from "./pages/lmt/service-logs";
import { UsageRoute } from "./pages/lmt/usage";
import { TracingRoute } from "./pages/lmt/tracing";
import { LmtTraceDetailRoute } from "./pages/lmt/trace-detail";
import { LmtServiceLogTraceRoute } from "./pages/lmt/service-log-trace";
import { IdpSettingsPage } from "./idp/settings/pages/settings-page";

const redirectPaths: Record<string, string> = {
  "/services/authentication/user-detail/*": "/services/authentication",
  "/services/authentication/role-detail/*": "/services/authentication/roles",
  "/services/authentication/organization-detail/*":
    "/services/authentication/organizations",
  "/services/authentication/permission-detail/*":
    "/services/authentication/permissions",
};

export const router = createBrowserRouter([
  // ── Public invitation accept flow (no auth guard) ──
  { path: "/invitation", element: <InvitationConfirmPage /> },
  { path: "/invitation/result", element: <InvitationResultPage /> },
  { path: "/activate", element: <ActivatePage /> },

  {
    element: <Outlet />,
    children: [
      // Login callback outside AuthResolver (handled by blocks-kit)
      {
        path: "/login/callback",
        element: <CallbackPage redirectUrl="/console" />,
      },

      {
        element: (
          <AuthResolver>
            <Outlet />
          </AuthResolver>
        ),
        children: [
          // public
          {
            element: (
              <PublicGuard>
                <Outlet />
              </PublicGuard>
            ),
            // children: [{ path: "/login", element: <LoginPage /> }],
            children: [{ path: "/login", element: <LoginPage /> }],
          },

          // protected
          {
            element: (
              <ProtectedGuard>
                <Outlet />
              </ProtectedGuard>
            ),
            children: [
              // ── Console routes (profile, console, create-project, etc.) ──
              {
                element: (
                  <ConsoleLayout>
                    <Outlet />
                  </ConsoleLayout>
                ),
                children: [
                  { path: "/profile", element: <ProfilePage /> },
                  {
                    path: "/console",
                    element: <ConsolePage canCreateProject />,
                  },
                  {
                    path: "/create-project",
                    element: <CreateProjectWrapper />,
                  },
                  {
                    path: "/data-migration",
                    element: <EnvironmentMigrationPage />,
                  },
                  { path: "/callback", element: <GitHubCallbackPage /> },
                ],
              },

              // ── Project overview layout ──
              {
                element: (
                  <ProjectOverviewLayout
                    redirectPaths={redirectPaths}
                    navigationMenus={navigationMenus}>
                    <Outlet />
                  </ProjectOverviewLayout>
                ),
                children: [
                  {
                    path: "/project-overview",
                    element: (
                      <Navigate to="/project-overview/environments" replace />
                    ),
                  },
                  {
                    path: "/project-overview/environments",
                    element: <EnvironmentsPage />,
                  },
                  {
                    path: "/project-overview/people",
                    element: <PeopleManagement />,
                  },
                  {
                    path: "/project-overview/people/:id",
                    element: <PersonDetailPage />,
                  },
                  {
                    path: "/project-overview/repositories",
                    element: <RepositoriesPage />,
                  },
                  {
                    path: "/project-overview/settings",
                    element: <SettingsPage />,
                  },
                  {
                    path: "/project-overview/subscription-usage",
                    element: <SubscriptionUsagePage />,
                  },
                ],
              },

              // ── Dashboard layout (impersonated routes) ──
              {
                element: (
                  <DashboardLayout
                    redirectPaths={redirectPaths}
                    navigationMenus={navigationMenus}>
                    <Outlet />
                  </DashboardLayout>
                ),
                children: [
                  { path: "/dashboard", element: <DashboardOverview /> },
                  {
                    path: "/services/secret-management",
                    element: <SecretManagementLayout />,
                    children: [
                      {
                        index: true,
                        path: "my-secret",
                        element: <SecretsList />,
                      },
                      {
                        path: "managed-services",
                        element: <ManagedServicesPage />,
                      },
                      {
                        path: "oidc",
                        element: <OIDC />,
                      },
                      {
                        path: "client-credentials",
                        element: <ClientCredentials />,
                      },
                      {
                        path: "identity-providers",
                        element: <IdentityProviderPage />,
                      },
                      {
                        path: "sso",
                        element: <SSO />,
                      },
                      {
                        path: "external-idp",
                        element: <Certificates />,
                      },
                      {
                        path: "captcha",
                        element: <ConfigureCaptcha />,
                      },
                      {
                        path: "mfa",
                        element: <ConfigureMFA />,
                      },
                      {
                        path: "magic-url",
                        element: <MagicUrls />,
                        children: [
                          {
                            path: ":id",
                            element: <MagicUrlDetailsPage />,
                          },
                        ],
                      },
                      {
                        path: "storage",
                        element: <StorageContents />,
                      },
                      {
                        path: "email",
                        element: <EmailConfigurationPage />,
                      },
                      {
                        path: "notification",
                        element: <NotificationConfigurationListPage />,
                      },
                      {
                        path: "external-idp",
                        element: <Certificates />,
                      },
                      {
                        path: "ai-models",
                        element: <AIModels />,
                        children: [
                          {
                            path: ":provider",
                            element: <AiModelSelectedRoute />,
                          },
                        ],
                      },
                    ],
                  },
                  {
                    path: "/services/authentication",
                    element: <AuthenticationConfigLayout />,
                    children: [
                      {
                        path: "config",
                        element: <IdpSettingsPage />,
                      },
                      {
                        path: "oidc-template",
                        element: <OidcTemplate />,
                      },
                      {
                        path: "roles",
                        element: <Roles />,
                      },
                      {
                        path: "permissions",
                        element: <Permissions />,
                      },
                      {
                        path: "permission-detail/new",
                        element: <IamAddPermissionPage />,
                      },
                    ],
                  },
                  {
                    path: "/services/lmt",
                    element: <LmtPage />,
                    children: [
                      { path: "usage", element: <UsageRoute /> },
                      { path: "tracing", element: <TracingRoute /> },
                      { path: "tracing/:traceId", element: <LmtTraceDetailRoute /> },
                      { path: "logs", element: <LogsRoute /> },
                      { path: "logs/:serviceName/trace/:traceId", element: <LmtServiceLogTraceRoute /> },
                      { path: "logs/:serviceName", element: <LmtServiceLogsRoute /> },
                    ],
                  },

                  { path: "/services/iam", element: <IamPage /> },
                  {
                    path: "/services/iam/role-detail/:id",
                    element: <IamRoleDetailPage />,
                  },

                  {
                    path: "/services/iam/permission-detail/:id",
                    element: <IamPermissionDetailPage />,
                  },
                  {
                    path: "/services/iam/organization-detail/:itemId",
                    element: <IamOrgDetailPage />,
                  },
                  {
                    path: "/services/iam/configure",
                    element: <IamConfigurePage />,
                  },

                  {
                    path: "/services/authentication/sso-configuration",
                    element: <SsoConfigurationPage />,
                  },

                  {
                    path: "/services/api-settings",
                    element: <ApiSettingsPage />,
                  },
                  {
                    path: "/services/rate-limiter",
                    element: <RateLimiterPage />,
                  },

                  {
                    path: "/tracing/timeline/:traceId",
                    element: <LmtTraceDetailsRedirect />,
                  },

                  {
                    path: "/services/captcha",
                    element: (
                      <Navigate
                        to="/services/secret-management/captcha"
                        replace
                      />
                    ),
                  },
                  {
                    path: "/services/mfa",
                    element: (
                      <Navigate to="/services/secret-management/mfa" replace />
                    ),
                  },
                ],
              },
            ],
          },

          // ── Root redirect: authenticated users go to console ──
          // { path: "/", element: <Navigate to="/console" replace /> },
          // ── Catch-all: redirect to login ──

          { path: "*", element: <Navigate to="/console" replace /> },
        ],
      },
    ],
  },
]);
