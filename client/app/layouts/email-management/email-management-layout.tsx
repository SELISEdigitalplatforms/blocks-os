import { Outlet } from "react-router";

export function EmailManagementLayout() {
  return (
    <main className="flex flex-col gap-6 p-6">
      <Outlet />
    </main>
  );
}
