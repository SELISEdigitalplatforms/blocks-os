import type { UseQueryResult } from "@tanstack/react-query"

type SettingsTabQueryState<TData> = {
  data: TData | undefined
  showLoader: boolean
  showError: boolean
}

/** Show loader only until first successful data arrives (not on background refetch). */
export const getSettingsTabQueryState = <TData>(
  query: Pick<UseQueryResult<TData>, "data" | "isPending" | "isError">,
): SettingsTabQueryState<TData> => ({
  data: query.data,
  showLoader: query.isPending,
  showError: query.isError || (!query.isPending && query.data == null),
})
