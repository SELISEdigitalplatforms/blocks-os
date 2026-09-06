import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type OidcBrandingHeaderActions = {
  onSave: () => void;
  onUndo: () => void;
  isBusy: boolean;
  isDirty: boolean;
  isValid: boolean;
};

type OidcBrandingHeaderContextValue = {
  actions: OidcBrandingHeaderActions | null;
  setActions: (actions: OidcBrandingHeaderActions | null) => void;
};

const OidcBrandingHeaderContext = createContext<OidcBrandingHeaderContextValue | null>(null);

export const OidcBrandingHeaderProvider = ({ children }: { children: ReactNode }) => {
  const [actions, setActionsState] = useState<OidcBrandingHeaderActions | null>(null);

  const setActions = useCallback((next: OidcBrandingHeaderActions | null) => {
    setActionsState(next);
  }, []);

  const value = useMemo(
    () => ({
      actions,
      setActions,
    }),
    [actions, setActions],
  );

  return (
    <OidcBrandingHeaderContext.Provider value={value}>
      {children}
    </OidcBrandingHeaderContext.Provider>
  );
};

export const useOidcBrandingHeader = () => {
  const context = useContext(OidcBrandingHeaderContext);
  if (!context) {
    throw new Error("useOidcBrandingHeader must be used within OidcBrandingHeaderProvider");
  }
  return context;
};

export const useOidcBrandingHeaderOptional = () => {
  return useContext(OidcBrandingHeaderContext);
};
