import { Outlet } from "react-router";

export function EmailManagementLayout() {
  return (
    <main className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:gap-6 sm:p-6">
      <Outlet />
    </main>
  );
}
