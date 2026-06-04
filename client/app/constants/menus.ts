import { Menu } from "@/models/menu-models";
import { Home, Package, Users, BookMinus, Settings, Shield, Key, ShieldCheck, ScanFace, Lock, Zap, Gauge, CreditCard } from "lucide-react";
import { SECRET_MANAGEMENT_NAV_GROUPS } from "./secret-management-nav";
import { AUTHENTICATION_NAV_GROUPS } from "./authentication-nav";
import { LMT_NAV_GROUPS } from "./lmt-nav";

// Helper to convert NavGroups into Menu[]
const mapNavGroupsToMenus = (groups: any[], routePrefix: string): Menu[] => {
  return groups.flatMap(group => 
    group.items.map((item: any) => ({
      id: item.id,
      type: "menu" as const,
      name: item.label,
      path: `${routePrefix}?tab=${item.value}`,
      icon: item.icon,
    }))
  );
};

export const navigationMenus: Menu[] = [
  {
    id: "overview-project",
    type: "menu",
    name: "Overview",
    path: "/dashboard",
    icon: Home,
  },
  {
    type: "separator",
    id: "separator-overview",
  },
  {
    id: "environments",
    type: "menu",
    name: "Environments",
    path: "/project-overview/environments",
    icon: Package,
  },
  {
    id: "people",
    type: "menu",
    name: "People",
    path: "/project-overview/people",
    icon: Users,
  },
  {
    id: "repositories",
    type: "menu",
    name: "Repositories",
    path: "/project-overview/repositories",
    icon: BookMinus,
  },
  {
    id: "settings",
    type: "menu",
    name: "Project Settings",
    path: "/project-overview/settings",
    icon: Settings,
  },
  {
    id: "subscription-usage",
    type: "menu",
    name: "Subscription Usage",
    path: "/project-overview/subscription-usage",
    icon: CreditCard,
  },
  {
    type: "separator",
    id: "separator-identity",
  },
  {
    id: "service-identity__secret-management",
    type: "menu",
    name: "Secrets & Configs",
    path: "/services/secret-management",
    icon: Lock,
    children: mapNavGroupsToMenus(SECRET_MANAGEMENT_NAV_GROUPS, "/services/secret-management"),
  },
  {
    id: "service-identity__api-settings",
    type: "menu",
    name: "API Settings",
    path: "/services/api-settings",
    icon: Settings,
  },
  {
    id: "service-identity__authentication",
    type: "menu",
    name: "IDP",
    path: "/services/authentication",
    icon: Key,
    children: mapNavGroupsToMenus(AUTHENTICATION_NAV_GROUPS, "/services/authentication"),
  },
  {
    type: "separator",
    id: "separator-lmt",
  },
  {
    id: "service-identity__lmt",
    type: "menu",
    name: "LMT",
    path: "/services/lmt",
    icon: Zap,
    children: mapNavGroupsToMenus(LMT_NAV_GROUPS, "/services/lmt"),
  },
];
