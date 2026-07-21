import { Button } from "@/components/ui-kits/button/button"
import type { SettingsTabValue } from "@blocks-idp/settings/models/settings.model"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type SettingsFormTabButtonsProps = {
  onReset: () => void
  onSave: () => void
  resetDisabled?: boolean
  saveDisabled?: boolean
}

export const SettingsFormTabButtons = ({
  onReset,
  onSave,
  resetDisabled = false,
  saveDisabled = false,
}: SettingsFormTabButtonsProps) => (
  <>
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="w-20"
      disabled={resetDisabled}
      onClick={onReset}
    >
      Reset
    </Button>
    <Button size="sm" type="button" className="w-20" disabled={saveDisabled} onClick={onSave}>
      Save
    </Button>
  </>
)

type SettingsTabActionsContextValue = {
  actionsByTab: Partial<Record<SettingsTabValue, ReactNode>>
  registerActions: (tabId: SettingsTabValue, actions: ReactNode) => void
  unregisterActions: (tabId: SettingsTabValue) => void
}

const SettingsTabActionsContext = createContext<SettingsTabActionsContextValue | null>(null)

const useSettingsTabActionsContext = () => {
  const context = useContext(SettingsTabActionsContext)

  if (!context) {
    throw new Error("Settings tab actions must be used within SettingsTabActionsProvider")
  }

  return context
}

export const SettingsTabActionsProvider = ({ children }: { children: ReactNode }) => {
  const [actionsByTab, setActionsByTab] = useState<
    Partial<Record<SettingsTabValue, ReactNode>>
  >({})

  const registerActions = useCallback((tabId: SettingsTabValue, actions: ReactNode) => {
    setActionsByTab((current) => ({ ...current, [tabId]: actions }))
  }, [])

  const unregisterActions = useCallback((tabId: SettingsTabValue) => {
    setActionsByTab((current) => {
      if (!(tabId in current)) {
        return current
      }

      const next = { ...current }
      delete next[tabId]
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ actionsByTab, registerActions, unregisterActions }),
    [actionsByTab, registerActions, unregisterActions],
  )

  return (
    <SettingsTabActionsContext.Provider value={value}>{children}</SettingsTabActionsContext.Provider>
  )
}

type SettingsTabActionsSlotProps = {
  activeTab: SettingsTabValue
}

export const SettingsTabActionsSlot = ({ activeTab }: SettingsTabActionsSlotProps) => {
  const { actionsByTab } = useSettingsTabActionsContext()
  const actions = actionsByTab[activeTab]

  if (!actions) {
    return null
  }

  return (
    <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
      {actions}
    </div>
  )
}

type SettingsTabActionsProps = {
  tabId: SettingsTabValue
  children: ReactNode
}

export const SettingsTabActions = ({ tabId, children }: SettingsTabActionsProps) => {
  const { registerActions, unregisterActions } = useSettingsTabActionsContext()

  useEffect(() => {
    registerActions(tabId, children)

    return () => {
      unregisterActions(tabId)
    }
  }, [tabId, children, registerActions, unregisterActions])

  return null
}
