import { createBrowserRouter, Navigate } from "react-router-dom";
import { DashboardLayout } from "./layouts/dashboard-layout";
import { ConsoleLayout } from "./layouts/console-layout";
import LoginSimplePage from "./routes/auth/login-simple";

import IamPage from "./routes/dashboard/iam";
import IamRoleDetailPage from "./routes/dashboard/iam-role-detail";
import IamPermissionDetailPage from "./routes/dashboard/iam-permission-detail";
import IamAddPermissionPage from "./routes/dashboard/iam-add-permission";
import IamOrgDetailPage from "./routes/dashboard/iam-org-detail";
import IamLogsPage from "./routes/dashboard/iam-logs";
import IamConfigurePage from "./routes/dashboard/iam-configure";
import AuthenticationConfigPage from "./routes/dashboard/authentication-config";
import SsoConfigurationPage from "./routes/dashboard/sso-configuration";
import AuthLogsPage from "./routes/dashboard/auth-logs";
import MfaLogsPage from "./routes/dashboard/mfa-logs";
import CaptchaLogsPage from "./routes/dashboard/captcha-logs";
import ApiSettingsPage from "./routes/dashboard/api-settings";
import RateLimiterPage from "./routes/dashboard/rate-limiter";
import LmtPage from "./routes/dashboard/lmt";
import LmtServiceLogsPage from "./routes/dashboard/lmt-service-logs";
import LmtTraceDetailsPage from "./routes/dashboard/lmt-trace-details";
import SecretManagementPage from "./routes/dashboard/secret-management";
import MagicUrlDetailsPage from "./routes/dashboard/magic-url-details";
import AiModelSelectedRoute from "./routes/dashboard/ai-model-selected";
import ManagedServicesPage from "./routes/dashboard/managed-services";
import ProfilePage from "./routes/dashboard/profile";
import { Console } from "./pages/console/console";
import { DashboardOverview } from "./pages/dashboard/dashboard-overview";
import {
  EnvironmentsPage,
  EnvironmentMigrationPage,
} from "./pages/environments/environments";
import { PeopleManagement } from "./pages/people/people-management";
import { PersonDetailPage } from "./pages/people/person-detail-page";
import { RepositoriesPage } from "./pages/repositories/repositories";
import { SettingsPage } from "./pages/settings/settings";
import { CreateProjectWrapper } from "./pages/create-project/create-project";
import CallbackPage from "./routes/callback/callback";
import { ProjectOverviewLayout } from "./layouts/project-overview-layout";
import LoginCallbackPage from "./routes/auth/callback";
import { SubscriptionUsagePage } from "./pages/subscription-usage/subscription-usage-page";
import SsoCallbackPage from "./routes/auth/sso-callback";
import { InvitationConfirmPage } from "./pages/invitation/invitation-confirm-page";
import { InvitationResultPage } from "./pages/invitation/invitation-result-page";
import ActivatePage from "./routes/auth/activate-page";

export const router = createBrowserRouter([
  // ── Public invitation accept flow (no auth guard) ──
  { path: "/invitation", element: <InvitationConfirmPage /> },
  { path: "/invitation/result", element: <InvitationResultPage /> },
  { path: "/activate", element: <ActivatePage /> },

  // ── IDP service login (initiates OIDC flow + handles callback) ──
  {
    path: "/login",
    children: [
      { index: true, element: <LoginSimplePage /> },
      { path: "callback", element: <LoginCallbackPage /> },
    ],
  },

  // ── Console layout (profile, console pages without sidebar) ──
  {
    element: <ConsoleLayout />,
    children: [
      { path: "/profile", element: <ProfilePage /> },
      { path: "/console", element: <Console /> },
      { path: "/create-project", element: <CreateProjectWrapper /> },
      { path: "/data-migration", element: <EnvironmentMigrationPage /> },
      { path: "/callback", element: <CallbackPage /> },
    ],
  },
  // ── Project overview layout ( project overview pages) ──
  {
    element: <ProjectOverviewLayout />,
    children: [
      {
        path: "/project-overview",
        element: <Navigate to="/project-overview/environments" replace />,
      },
      { path: "/project-overview/environments", element: <EnvironmentsPage /> },
      { path: "/project-overview/people", element: <PeopleManagement /> },
      { path: "/project-overview/people/:id", element: <PersonDetailPage /> },
      { path: "/project-overview/repositories", element: <RepositoriesPage /> },
      { path: "/project-overview/settings", element: <SettingsPage /> },
      {
        path: "/project-overview/subscription-usage",
        element: <SubscriptionUsagePage />,
      },
    ],
  },
  // ── Dashboard layout (protected routes + future impersonated pages) ──
  {
    element: <DashboardLayout />,
    children: [
      { path: "/dashboard", element: <DashboardOverview /> },
      { path: "/services/iam", element: <IamPage /> },
      { path: "/services/iam/role-detail/:id", element: <IamRoleDetailPage /> },
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
      { path: "/services/iam/configure", element: <IamConfigurePage /> },
      {
        path: "/services/authentication",
        element: <AuthenticationConfigPage />,
      },
      {
        path: "/services/authentication/sso-configuration",
        element: <SsoConfigurationPage />,
      },
      { path: "/services/authentication/logs", element: <AuthLogsPage /> },
      {
        path: "/services/mfa",
        element: <Navigate to="/services/secret-management?tab=mfa" replace />,
      },
      { path: "/services/mfa/logs", element: <MfaLogsPage /> },
      { path: "/services/api-settings", element: <ApiSettingsPage /> },
      { path: "/services/rate-limiter", element: <RateLimiterPage /> },
      { path: "/services/lmt", element: <LmtPage /> },
      {
        path: "/services/lmt/logs/:serviceName",
        element: <LmtServiceLogsPage />,
      },
      { path: "/tracing/timeline/:traceId", element: <LmtTraceDetailsPage /> },
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
      { path: "/managed-services", element: <ManagedServicesPage /> },
      {
        path: "/services/captcha",
        element: (
          <Navigate to="/services/secret-management?tab=captcha" replace />
        ),
      },
      { path: "/services/captcha/logs", element: <CaptchaLogsPage /> },
    ],
  },

  // ── Root redirect: authenticated users go to console ──
  { path: "/", element: <Navigate to="/console" replace /> },
  // ── Catch-all: redirect to login ──
  { path: "*", element: <Navigate to="/login" replace /> },
]);
