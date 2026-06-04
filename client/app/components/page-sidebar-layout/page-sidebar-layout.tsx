import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NavGroup } from "@/constants/secret-management-nav";
type PageSidebarLayoutProps = {
  navGroups: NavGroup[];
  selectedTab: string;
  onTabChange: (value: string) => void;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
};
export function PageSidebarLayout({
  navGroups,
  selectedTab,
  onTabChange,
  headerContent,
  children,
}: PageSidebarLayoutProps) {
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const location = useLocation();
  useEffect(() => {
    if (!isDesktopSidebarOpen) {
      setIsDesktopSidebarOpen(true);
    }
  }, [location.key]);
  const handleTabChange = (value: string) => {
    onTabChange(value);
  };
  const SidebarNav = ({ showCollapse = false }: { showCollapse?: boolean }) => (
    <nav className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto py-1">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = selectedTab === item.value;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.value)}
                  className={cn(
                    "relative flex h-10 w-full cursor-pointer items-center gap-3 px-4 py-1.5 text-sm transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="absolute right-0 top-2.5 h-5 w-1 rounded-l-lg bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
  const currentItem = navGroups.flatMap((g) => g.items).find((item) => item.value === selectedTab);
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {isDesktopSidebarOpen && (
        <aside className="hidden h-screen w-52 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
          <SidebarNav showCollapse={true} />
        </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {currentItem && (
              <div>
                <h1 className="text-lg font-semibold text-[hsl(var(--high-emphasis))]">
                  {currentItem.label}
                </h1>
                <p className="text-xs text-muted-foreground">{currentItem.desc}</p>
              </div>
            )}
          </div>
          {headerContent && <div className="flex items-center gap-2">{headerContent}</div>}
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
