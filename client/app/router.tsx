import {
  AuthResolver,
  ProtectedGuard,
  PublicGuard,
} from "@seliseblocks/blocks-kit/guards";
import {
  ConsoleLayout,
  DashboardRoute,
  ProjectOverviewRoute,
} from "@seliseblocks/blocks-kit/layouts";
import {
  CallbackPage,
  ConsolePage,
  DashboardOverview,
  LoginPage,
  ProfilePage,
} from "@seliseblocks/blocks-kit/pages";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { navigationMenus } from "./constants/navigation-menus";
import { AIModels } from "./cross-modules/ai/pages/ai-models";
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
import IamPermissionDetailPage from "./routes/dashboard/iam-permission-detail";
import IamRoleDetailPage from "./routes/dashboard/iam-role-detail";
import LmtTraceDetailsRedirect from "./routes/dashboard/lmt-trace-details";
import MagicUrlDetailsPage from "./routes/dashboard/magic-url-details";
import ManagedServicesPage from "./routes/dashboard/managed-services";
import OidcBrandingPage from "./routes/dashboard/oidc-branding";
import SecretManagementLayout from "./routes/dashboard/secret-management";
import LmtLayout from "@/layouts/lmt/lmt-layout";

const redirectPaths: Record<string, string> = {
  "/app/idp/user-detail/*": "/app/idp",
  "/app/idp/role-detail/*": "/app/idp/roles",
  "/app/idp/organization-detail/*": "/app/idp/organizations",
  "/app/idp/permission-detail/*": "/app/idp/permissions",
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
        element: <CallbackPage />,
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
              {
                index: true,
                element: <Navigate to="console" replace />,
              },
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
                path: "project/:tenantGroupId",
                element: (
                  <ProjectOverviewRoute
                    redirectPaths={redirectPaths}
                    navigationMenus={navigationMenus}
                  />
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

              // ── Dashboard layout (impersonated routes, scoped by :itemId) ──
              {
                path: ":itemId",
                element: (
                  <DashboardRoute
                    redirectPaths={redirectPaths}
                    navigationMenus={navigationMenus}
                  />
                ),
                children: [
                  {
                    index: true,
                    element: <Navigate to="dashboard" replace />,
                  },
                  {
                    path: "dashboard",
                    element: <DashboardOverview />,
                  },
                  {
                    path: "secret-management",
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
                        children: [
                          {
                            index: true,
                            element: <OIDC />,
                          },
                          {
                            path: ":clientId/branding",
                            element: <OidcBrandingPage />,
                          },
                        ],
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
                    path: "idp",
                    element: <AuthenticationConfigLayout />,
                    children: [
                      {
                        index: true,
                        element: <Navigate to="settings" replace />,
                      },
                      {
                        path: "settings",
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
                        path: "role-detail",
                        element: <Navigate to="../roles" replace />,
                      },
                      {
                        path: "role-detail/:id",
                        element: <IamRoleDetailPage />,
                      },
                      {
                        path: "permissions",
                        element: <Permissions />,
                      },
                      {
                        path: "permission-detail",
                        element: <Navigate to="../permissions" replace />,
                      },
                      {
                        path: "permission-detail/new",
                        element: <IamAddPermissionPage />,
                      },
                      {
                        path: "permission-detail/:id",
                        element: <IamPermissionDetailPage />,
                      },
                    ],
                  },
                  {
                    path: "api-settings",
                    element: <ApiSettingsPage />,
                  },
                  {
                    path: "lmt",
                    element: <LmtLayout />,
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
                      {
                        path: "logs",
                        element: <Outlet />,
                        children: [
                          {
                            index: true,
                            element: <LogsRoute />,
                          },
                          {
                            path: ":serviceName",
                            element: <LmtServiceLogsRoute />,
                          },
                          {
                            path: ":serviceName/trace/:traceId",
                            element: <LmtServiceLogTraceRoute />,
                          },
                        ],
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
