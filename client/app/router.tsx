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
import AuthLogsPage from "./routes/dashboard/auth-logs";
import AuthenticationConfigPage from "./routes/dashboard/authentication-config";
import CaptchaLogsPage from "./routes/dashboard/captcha-logs";
import IamPage from "./routes/dashboard/iam";
import IamAddPermissionPage from "./routes/dashboard/iam-add-permission";
import IamConfigurePage from "./routes/dashboard/iam-configure";
import IamLogsPage from "./routes/dashboard/iam-logs";
import IamOrgDetailPage from "./routes/dashboard/iam-org-detail";
import IamPermissionDetailPage from "./routes/dashboard/iam-permission-detail";
import IamRoleDetailPage from "./routes/dashboard/iam-role-detail";
import LmtPage from "./routes/dashboard/lmt";
import LmtServiceLogsPage from "./routes/dashboard/lmt-service-logs";
import LmtTraceDetailsPage from "./routes/dashboard/lmt-trace-details";
import MagicUrlDetailsPage from "./routes/dashboard/magic-url-details";
import ManagedServicesPage from "./routes/dashboard/managed-services";
import MfaLogsPage from "./routes/dashboard/mfa-logs";
import RateLimiterPage from "./routes/dashboard/rate-limiter";
import SecretManagementPage from "./routes/dashboard/secret-management";
import SsoConfigurationPage from "./routes/dashboard/sso-configuration";

const redirectPaths: Record<string, string> = {
  "/services/iam/user-detail/*": "/services/iam",
  "/services/iam/role-detail/*": "/services/iam?tab=roles",
  "/services/iam/organization-detail/*": "/services/iam",
  "/services/iam/permission-detail/*": "/services/iam",
  "/services/authentication/sso-configuration":
    "/services/authentication?tab=social",
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
                  { path: "/services/iam", element: <IamPage /> },
                  {
                    path: "/services/iam/role-detail/:id",
                    element: <IamRoleDetailPage />,
                  },
                  {
                    path: "/services/iam/permission-detail/new",
                    element: <IamAddPermissionPage />,
                  },
                  {
                    path: "/services/iam/permission-detail/:id",
                    element: <IamPermissionDetailPage />,
                  },
                  {
                    path: "/services/iam/organization-detail/:itemId",
                    element: <IamOrgDetailPage />,
                  },
                  { path: "/services/iam/logs", element: <IamLogsPage /> },
                  {
                    path: "/services/iam/configure",
                    element: <IamConfigurePage />,
                  },
                  {
                    path: "/services/authentication",
                    element: <AuthenticationConfigPage />,
                  },
                  {
                    path: "/services/authentication/sso-configuration",
                    element: <SsoConfigurationPage />,
                  },
                  {
                    path: "/services/authentication/logs",
                    element: <AuthLogsPage />,
                  },
                  {
                    path: "/services/mfa",
                    element: (
                      <Navigate
                        to="/services/secret-management?tab=mfa"
                        replace
                      />
                    ),
                  },
                  { path: "/services/mfa/logs", element: <MfaLogsPage /> },
                  {
                    path: "/services/api-settings",
                    element: <ApiSettingsPage />,
                  },
                  {
                    path: "/services/rate-limiter",
                    element: <RateLimiterPage />,
                  },
                  { path: "/services/lmt", element: <LmtPage /> },
                  {
                    path: "/services/lmt/logs/:serviceName",
                    element: <LmtServiceLogsPage />,
                  },
                  {
                    path: "/tracing/timeline/:traceId",
                    element: <LmtTraceDetailsPage />,
                  },
                  {
                    path: "/services/secret-management",
                    element: <SecretManagementPage />,
                  },
                  {
                    path: "/services/secret-management/magic-url/:id",
                    element: <MagicUrlDetailsPage />,
                  },
                  {
                    path: "/services/secret-management/ai-models/:provider",
                    element: <AiModelSelectedRoute />,
                  },
                  {
                    path: "/managed-services",
                    element: <ManagedServicesPage />,
                  },
                  {
                    path: "/services/captcha",
                    element: (
                      <Navigate
                        to="/services/secret-management?tab=captcha"
                        replace
                      />
                    ),
                  },
                  {
                    path: "/services/captcha/logs",
                    element: <CaptchaLogsPage />,
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
