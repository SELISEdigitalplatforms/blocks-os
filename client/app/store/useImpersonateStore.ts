import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ImpersonateState {
  isImpersonating: boolean;
  isImpersonated: boolean;
  impersonatedTenantId: string | null;
  originalTenantId: string | null;
  startImpersonation: (impersonatedTenantId: string, originalTenantId: string) => void;
  stopImpersonation: () => void;
  reset: () => void;
}

export const useImpersonateStore = create<ImpersonateState>()(
  persist(
    (set) => ({
      isImpersonating: false,
      isImpersonated: false,
      impersonatedTenantId: null,
      originalTenantId: null,
      startImpersonation: (impersonatedTenantId: string, originalTenantId: string) => {
        set({ isImpersonating: true, isImpersonated: true, impersonatedTenantId, originalTenantId });
      },
      stopImpersonation: () => {
        set({ isImpersonating: false, isImpersonated: false, impersonatedTenantId: null, originalTenantId: null });
      },
      reset: () => {
        set({ isImpersonating: false, impersonatedTenantId: null, originalTenantId: null });
      },
    }),
    {
      name: "impersonate-storage",
    },
  ),
);
