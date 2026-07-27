import { AuthResolver, ProtectedGuard, PublicGuard } from "@seliseblocks/blocks-kit/guards";
import { ConsoleLayout, DashboardRoute } from "@seliseblocks/blocks-kit/layouts";
import { CallbackPage, ConsolePage, LoginPage, ProfilePage } from "@seliseblocks/blocks-kit/pages";
import { createBrowserRouter, Navigate, Outlet, useParams } from "react-router";
import { navigationMenus } from "./constants/navigation-menus";
// Temporarily disabled
// import { AIModels } from "./cross-modules/ai/pages/ai-models";
import {
  EmailConfigurationPage,
  EmailCommunicationDetails,
  EmailServiceTable,
  NewCommunication,
} from "./cross-modules/communication/mail";
import { EditEmailTemplate } from "./cross-modules/communication/mail/email/email-template-edit/email-template-edit";
import { EmailUsageDetails } from "./cross-modules/communication/mail/email/email-usage/email-usage-details";
import { NotificationConfigurationListPage } from "./cross-modules/communication/notification/components/notification-configuration-list";
// Temporarily disabled
// import { SecretsList } from "./cross-modules/secrets/components/secrets-list/secrets-list";
import { StorageContents } from "./cross-modules/storage/pages/storage/storage-contents";
// Temporarily disabled
// import { MagicUrls } from "./cross-modules/utilities/pages/magic-urls/magic-urls";
import { ClientCredentials } from "@blocks-idp/authentication/components/client-credentials";
import { OIDC } from "@blocks-idp/authentication/components/oidc";
import OidcTemplate from "@blocks-idp/authentication/components/oidc/oidc-template";
import { AuthenticationConfigLayout } from "@blocks-idp/authentication/pages/authentication-config";
import { Certificates } from "@blocks-idp/authentication/pages/authentication-config/general/certificates/certificates";
import { SSO } from "@blocks-idp/authentication/pages/authentication-config/sso";
import { ConfigureCaptcha } from "@blocks-idp/captcha/pages/configure-captcha";
import { Permissions } from "@blocks-idp/iam/modules/permission-management";
import { Roles } from "@blocks-idp/iam/modules/role-management";
import { ConfigureMFA } from "@blocks-idp/mfa/pages/configure-mfa/configure-mfa";
import { IdpSettingsPage } from "@blocks-idp/settings/pages/settings-page";
import { CreateProjectWrapper } from "./pages/create-project/create-project";
import { EnvironmentMigrationPage, EnvironmentsPage } from "./pages/environments/environments";
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
import GitHubCallbackPage from "./routes/github-callback/github-callback";
// Temporarily disabled
// import AiModelSelectedRoute from "./routes/dashboard/ai-model-selected";
import ApiSettingsPage from "./routes/dashboard/api-settings";
import IamAddPermissionPage from "./routes/dashboard/iam-add-permission";
import IamPermissionDetailPage from "./routes/dashboard/iam-permission-detail";
import IamRoleDetailPage from "./routes/dashboard/iam-role-detail";
import LmtTraceDetailsRedirect from "./routes/dashboard/lmt-trace-details";
// Temporarily disabled
// import MagicUrlDetailsPage from "./routes/dashboard/magic-url-details";
import LmtLayout from "@/layouts/lmt/lmt-layout";
import { ProjectOverviewRoute } from "@/layouts/project-overview-route";
import { DashboardOverview } from "@/pages/dashboard/dashboard-overview";
import MyServicesPage from "./routes/dashboard/my-services";
import OidcBrandingPage from "./routes/dashboard/oidc-branding";
import SecretManagementLayout from "./routes/dashboard/secret-management";
import { IdentityProviderPage } from "@blocks-idp/authentication/components/identity-provider/identity-provider";

const redirectPaths: Record<string, string> = {
  "/app/idp/user-detail/*": "/app/idp",
  "/app/idp/role-detail/*": "/app/idp/roles",
  "/app/idp/organization-detail/*": "/app/idp/organizations",
  "/app/idp/permission-detail/*": "/app/idp/permissions",
};

const emailPageShellClassName = "flex flex-col gap-6 p-6";

function EmailPage() {
  return (
    <div className={emailPageShellClassName}>
      <EmailServiceTable />
    </div>
  );
}

function EmailCommunicationDetailsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className={emailPageShellClassName}>
      <EmailCommunicationDetails params={{ id: id || "" }} />
    </div>
  );
}

function EmailTemplateEditPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className={emailPageShellClassName}>
      <EditEmailTemplate params={{ id: id || "" }} />
    </div>
  );
}

function EmailUsageDetailsPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className={emailPageShellClassName}>
      <EmailUsageDetails id={id || ""} />
    </div>
  );
}

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
                  <DashboardRoute redirectPaths={redirectPaths} navigationMenus={navigationMenus} />
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
                        element: <Navigate to="my-services" replace />,
                      },
                      // Temporarily disabled
                      // {
                      //   path: "my-secret",
                      //   element: <SecretsList />,
                      // },
                      {
                        path: "my-services",
                        element: <MyServicesPage />,
                      },
                      // Redirect from the retired "managed-services" path
                      {
                        path: "managed-services",
                        element: <Navigate to="/app/secret-management/my-services" replace />,
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
                      // Temporarily disabled
                      // {
                      //   path: "magic-url",
                      //   element: <MagicUrls />,
                      //   children: [
                      //     {
                      //       path: ":id",
                      //       element: <MagicUrlDetailsPage />,
                      //     },
                      //   ],
                      // },
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
                      // Temporarily disabled
                      // {
                      //   path: "ai-models",
                      //   element: <AIModels />,
                      //   children: [
                      //     {
                      //       path: ":provider",
                      //       element: <AiModelSelectedRoute />,
                      //     },
                      //   ],
                      // },
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
                        path: "role",
                        element: <Navigate to="../roles" replace />,
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
                        path: "permission",
                        element: <Navigate to="../permissions" replace />,
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
                    path: "email-management",
                    children: [
                      {
                        index: true,
                        element: <EmailPage />,
                      },
                      {
                        path: "new-communication",
                        element: <NewCommunication />,
                      },
                      {
                        path: "communications/:id",
                        element: <EmailCommunicationDetailsPage />,
                      },
                      {
                        path: "communications/:id/edit",
                        element: <EmailTemplateEditPage />,
                      },
                      {
                        path: "usage/:id",
                        element: <EmailUsageDetailsPage />,
                      },
                    ],
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
