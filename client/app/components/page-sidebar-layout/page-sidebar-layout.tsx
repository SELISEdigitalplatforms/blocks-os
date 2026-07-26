import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronsLeft, Menu } from "lucide-react";
import { PageHeader } from "@/components/page-header/page-header";
import { Button } from "@/components/ui-kits/button/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui-kits/sheet/sheet";
import { cn } from "@/lib/utils";
import { NavGroup } from "@/constants/secret-management-nav";
type PageSidebarLayoutProps = {
  navGroups: NavGroup[];
  selectedTab: string;
  onTabChange: (value: string) => void;
  headerContent?: React.ReactNode;
  children: React.ReactNode;
};
type SidebarNavProps = {
  showCollapse?: boolean;
  navGroups: NavGroup[];
  selectedTab: string;
  onSelect: (value: string) => void;
};
const SidebarNav = ({ navGroups, selectedTab, onSelect }: SidebarNavProps) => (
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
                onClick={() => onSelect(item.value)}
                className={cn(
                  "relative flex h-10 w-full cursor-pointer items-center gap-3 px-4 py-1.5 text-sm transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-[hsl(var(--low-emphasis))] hover:text-[hsl(var(--high-emphasis))]",
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
export function PageSidebarLayout({
  navGroups,
  selectedTab,
  onTabChange,
  headerContent,
  children,
}: PageSidebarLayoutProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const location = useLocation();
  useEffect(() => {
    if (!isDesktopSidebarOpen) {
      setIsDesktopSidebarOpen(true);
    }
  }, [location.key]);
  const handleTabChange = (value: string) => {
    onTabChange(value);
    setIsMobileSidebarOpen(false);
  };
  const currentItem = navGroups.flatMap((g) => g.items).find((item) => item.value === selectedTab);
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {isDesktopSidebarOpen && (
        <aside className="hidden h-screen w-52 shrink-0 border-r border-border bg-card lg:flex lg:flex-col">
          <SidebarNav showCollapse={true} navGroups={navGroups} selectedTab={selectedTab} onSelect={handleTabChange} />
        </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {currentItem && (
            <div className="mb-4 flex items-start gap-3 sm:mb-6">
              <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0 lg:hidden">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-52 p-0" hideClose>
                  <div className="flex h-full flex-col">
                    <SheetHeader className="flex-row items-center justify-between border-b border-border px-4 py-3">
                      <SheetTitle className="text-sm font-semibold">
                        Secrets &amp; Configs
                      </SheetTitle>
                      <SheetClose asChild>
                        <Button variant="ghost" size="icon" className="!mt-0 h-7 w-7 shrink-0">
                          <ChevronsLeft className="h-4 w-4" />
                          <span className="sr-only">Close sidebar</span>
                        </Button>
                      </SheetClose>
                    </SheetHeader>
                    <SidebarNav showCollapse={false} navGroups={navGroups} selectedTab={selectedTab} onSelect={handleTabChange} />
                  </div>
                </SheetContent>
              </Sheet>
              <PageHeader
                title={currentItem.label}
                description={currentItem.desc}
                actions={headerContent}
                className="mb-0 min-w-0 flex-1"
              />
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
