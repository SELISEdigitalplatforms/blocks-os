import {
  AuthResolver,
  CallbackPage,
  ConsoleLayout,
  ConsolePage,
  DashboardLayout,
  DashboardOverview,
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
import { IdpSettingsPage } from "./idp/settings/pages/settings-page";
import { CreateProjectWrapper } from "./pages/create-project/create-project";
import {
  EnvironmentMigrationPage,
  EnvironmentsPage,
} from "./pages/environments/environments";
import { InvitationConfirmPage } from "./pages/invitation/invitation-confirm-page";
import { InvitationResultPage } from "./pages/invitation/invitation-result-page";
import { LogsRoute } from "./pages/lmt/logs";
import { LmtServiceLogTraceRoute } from "./pages/lmt/service-log-trace";
import { LmtServiceLogsRoute } from "./pages/lmt/service-logs";
import { LmtTraceDetailRoute } from "./pages/lmt/trace-detail";
import { TracingRoute } from "./pages/lmt/tracing";
import { UsageRoute } from "./pages/lmt/usage";
import { PeopleManagement } from "./pages/people/people-management";
import { PersonDetailPage } from "./pages/people/person-detail-page";
import { RepositoriesPage } from "./pages/repositories/repositories";
import { SettingsPage } from "./pages/settings/settings";
import { SubscriptionUsagePage } from "./pages/subscription-usage/subscription-usage-page";
import ActivatePage from "./routes/auth/activate-page";
import GitHubCallbackPage from "./routes/callback/callback";
import AiModelSelectedRoute from "./routes/dashboard/ai-model-selected";
import ApiSettingsPage from "./routes/dashboard/api-settings";
import IamAddPermissionPage from "./routes/dashboard/iam-add-permission";
import LmtPage from "./routes/dashboard/lmt";
import LmtTraceDetailsRedirect from "./routes/dashboard/lmt-trace-details";
import MagicUrlDetailsPage from "./routes/dashboard/magic-url-details";
import ManagedServicesPage from "./routes/dashboard/managed-services";
import SecretManagementLayout from "./routes/dashboard/secret-management";

const redirectPaths: Record<string, string> = {
  "/app/services/authentication/user-detail/*": "/app/services/authentication",
  "/app/services/authentication/role-detail/*":
    "/app/services/authentication/roles",
  "/app/services/authentication/organization-detail/*":
    "/app/services/authentication/organizations",
  "/app/services/authentication/permission-detail/*":
    "/app/services/authentication/permissions",
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
        element: <CallbackPage redirectUrl="/app/console" />,
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
            path: "/app",
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
                  { path: "profile", element: <ProfilePage /> },
                  {
                    path: "console",
                    element: <ConsolePage canCreateProject />,
                  },
                  {
                    path: "create-project",
                    element: <CreateProjectWrapper />,
                  },
                  {
                    path: "data-migration",
                    element: <EnvironmentMigrationPage />,
                  },
                  { path: "callback", element: <GitHubCallbackPage /> },
                ],
              },

              // ── Project overview layout ──
              {
                path: "project-overview",
                element: (
                  <ProjectOverviewLayout
                    redirectPaths={redirectPaths}
                    navigationMenus={navigationMenus}>
                    <Outlet />
                  </ProjectOverviewLayout>
                ),
                children: [
                  {
                    index: true,
                    element: <Navigate to="environments" replace />,
                  },
                  {
                    path: "environments",
                    element: <EnvironmentsPage />,
                  },
                  {
                    path: "people",
                    element: <PeopleManagement />,
                  },
                  {
                    path: "people/:id",
                    element: <PersonDetailPage />,
                  },
                  {
                    path: "repositories",
                    element: <RepositoriesPage />,
                  },
                  {
                    path: "settings",
                    element: <SettingsPage />,
                  },
                  {
                    path: "subscription-usage",
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
                  { path: "dashboard", element: <DashboardOverview /> },
                  {
                    path: "services/secret-management",
                    element: <SecretManagementLayout />,
                    children: [
                      {
                        index: true,
                        element: <Navigate to="my-secret" replace />,
                      },
                      {
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
                    path: "services/authentication",
                    element: <AuthenticationConfigLayout />,
                    children: [
                      {
                        index: true,
                        element: <Navigate to="config" replace />,
                      },
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
                    path: "services/api-settings",
                    element: <ApiSettingsPage />,
                  },
                  {
                    path: "services/lmt",
                    element: <LmtPage />,
                    children: [
                      {
                        index: true,
                        element: <Navigate to="usage" replace />,
                      },
                      { path: "usage", element: <UsageRoute /> },
                      { path: "tracing", element: <TracingRoute /> },
                      {
                        path: "tracing/:traceId",
                        element: <LmtTraceDetailRoute />,
                      },
                      {
                        path: "tracing/timeline/:traceId",
                        element: <LmtTraceDetailsRedirect />,
                      },
                      { path: "logs", element: <LogsRoute /> },
                      {
                        path: "logs/:serviceName",
                        element: <LmtServiceLogsRoute />,
                      },
                      {
                        path: "logs/:serviceName/trace/:traceId",
                        element: <LmtServiceLogTraceRoute />,
                      },
                    ],
                  },
                ],
              },
            ],
          },

          // ── Root redirect: authenticated users go to console ──
          // { path: "/", element: <Navigate to="/console" replace /> },
          // ── Catch-all: redirect to login ──

          { path: "*", element: <Navigate to="/app/console" replace /> },
        ],
      },
    ],
  },
]);
