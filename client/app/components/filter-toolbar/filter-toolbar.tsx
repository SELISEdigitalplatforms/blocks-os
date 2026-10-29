import { ReactNode, useState } from "react";
import { FilterControls } from ".";
import { ResetButton } from "./reset-button/reset-button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "../ui-kits/sheet/sheet";
import { Button } from "../ui-kits/button/button";
import { Filter } from "lucide-react";
import { Badge } from "../ui-kits/badge/badge";
import { deepEqual } from "@/lib/utils";
export type FilterItem<T extends Record<string, unknown>> = {
  [K in keyof typeof FilterControls]: {
    key: keyof T;
    type: K;
    span?: number;
    label: string;
    props?: Omit<React.ComponentProps<(typeof FilterControls)[K]>, "value" | "onChange" | "label">;
  };
}[keyof typeof FilterControls];
export type FilterChangeHandler<T extends Record<string, unknown>> = <K extends keyof T>(
  key: K,
  value: T[K],
  values: T,
) => void;
type FilterToolbarProps<T extends Record<string, unknown>> = {
  filters: FilterItem<T>[];
  values: T;
  defaultValues: T;
  onChange: FilterChangeHandler<T>;
  onReset?: (values?: T) => void;
  hideGlobalResetButton?: boolean;
  showFirstFilterOnMobile?: boolean;
  /** Keep every configured control in one filter sheet at every breakpoint. */
  displayMode?: "responsive" | "sheet";
  sheetTriggerLabel?: string;
};
type ViewType = {
  Components: ReactNode[];
  onReset?: () => void;
  showReset: boolean;
  showFirstFilterOnMobile?: boolean;
  alwaysVisible?: boolean;
  activeFiltersCount?: number;
  triggerLabel?: string;
};
const FilterToolbarDesktopView = ({ Components, showReset, onReset }: ViewType) => {
  return (
    <div className="hidden flex-wrap items-center gap-4 md:flex">
      {Components.map((item) => item)}
      {showReset && (
        <ResetButton
          onClick={() => {
            if (onReset) onReset();
          }}
        />
      )}
    </div>
  );
};
export const FilterToolBarMobileView = ({
  Components,
  showReset,
  onReset,
  showFirstFilterOnMobile = true,
  alwaysVisible = false,
  activeFiltersCount = 0,
  triggerLabel = "Filters",
}: ViewType) => {
  const inlineComponents = showFirstFilterOnMobile ? Components.slice(0, 1) : [];
  const sheetComponents = showFirstFilterOnMobile ? Components.slice(1) : Components;

  return (
    <div
      className={
        alwaysVisible
          ? "flex items-center justify-end gap-2"
          : "flex items-center justify-end gap-2 md:hidden"
      }
    >
      {inlineComponents.length > 0 && (
        <div className="min-w-0 max-w-72 flex-1">{inlineComponents[0]}</div>
      )}
      {sheetComponents.length > 0 && (
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={
                alwaysVisible
                  ? "relative h-[34px] w-[34px] gap-2 border-dashed p-0 sm:w-auto sm:px-3"
                  : "relative h-8 w-8 p-0"
              }
              aria-label={triggerLabel}
            >
              <Filter className="h-4 w-4" />
              {alwaysVisible && <span className="hidden sm:inline">{triggerLabel}</span>}
              {activeFiltersCount > 0 && (
                <Badge
                  className={
                    alwaysVisible
                      ? "absolute -right-2 -top-2 h-4 min-w-4 px-1 text-[10px] sm:static sm:h-5 sm:min-w-5 sm:text-xs"
                      : "absolute -right-2 -top-2 h-4 min-w-4 px-1 text-[10px]"
                  }
                  aria-label={`${activeFiltersCount} active filters`}
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className={
              alwaysVisible
                ? "top-[60px] flex h-[calc(100dvh-60px)] w-full flex-col sm:max-w-md"
                : "w-full"
            }
            overlayClassName={alwaysVisible ? "top-[60px] bg-transparent" : undefined}
            aria-describedby="filter-description"
          >
            <SheetTitle className={alwaysVisible ? undefined : "mb-4"}>
              {alwaysVisible ? triggerLabel : "Filter"}
            </SheetTitle>
            <SheetDescription
              id="filter-description"
              className={alwaysVisible ? "mb-2" : undefined}
            >
              {alwaysVisible ? "Refine the results using one or more filters." : ""}
            </SheetDescription>
            {alwaysVisible ? (
              <>
                <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto py-2 [&>button]:w-full [&>button]:max-w-full [&>button]:overflow-hidden">
                  {sheetComponents.map((item) => item)}
                </div>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {showReset && (
                    <ResetButton
                      onClick={() => {
                        if (onReset) onReset();
                      }}
                    />
                  )}
                  <SheetClose asChild>
                    <Button size="sm" className="h-8">
                      Show Results
                    </Button>
                  </SheetClose>
                </div>
              </>
            ) : (
              <div className="flex flex-col space-y-4">
                {sheetComponents.map((item) => item)}
                <SheetClose asChild>
                  <Button className="mt-4" size="sm">
                    Show Results
                  </Button>
                </SheetClose>
                {showReset && (
                  <ResetButton
                    onClick={() => {
                      if (onReset) onReset();
                    }}
                  />
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};
export const FilterToolbar = <T extends Record<string, unknown>>({
  filters,
  values,
  onChange,
  onReset,
  defaultValues,
  hideGlobalResetButton = false,
  showFirstFilterOnMobile = true,
  displayMode = "responsive",
  sheetTriggerLabel = "Filters",
}: FilterToolbarProps<T>) => {
  // Frozen snapshot of the first render's defaults. useState (not useRef) so it can be read
  // during render; both keep only the initial value, so behaviour is unchanged.
  const [initialValues] = useState(defaultValues);
  const changeHandler = <K extends keyof T>(key: K, value: T[K]) => {
    const changedValues = { ...values, [key]: value };
    onChange(key, value, changedValues);
  };
  const controllers = filters.map((item) => {
    const Component = FilterControls[item.type];
    return (
      <Component
        {...item}
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-expect-error
        value={values[item.key]}
        onChange={(val: unknown) => changeHandler(item.key as keyof T, val as T[keyof T])}
        {...item.props}
        key={String(item.key)}
      />
    );
  });
  const showReset = !hideGlobalResetButton && !deepEqual(initialValues, values);
  const activeFiltersCount = filters.reduce(
    (count, filter) => count + (deepEqual(values[filter.key], initialValues[filter.key]) ? 0 : 1),
    0,
  );

  if (displayMode === "sheet") {
    return (
      <FilterToolBarMobileView
        Components={controllers}
        showReset={showReset}
        onReset={() => onReset && onReset(initialValues)}
        showFirstFilterOnMobile={false}
        alwaysVisible
        activeFiltersCount={activeFiltersCount}
        triggerLabel={sheetTriggerLabel}
      />
    );
  }

  return (
    <>
      <FilterToolbarDesktopView
        Components={controllers}
        showReset={showReset}
        onReset={() => onReset && onReset(initialValues)}
      />
      <FilterToolBarMobileView
        Components={controllers}
        showReset={showReset}
        onReset={() => onReset && onReset(initialValues)}
        showFirstFilterOnMobile={showFirstFilterOnMobile}
      />
    </>
  );
};
