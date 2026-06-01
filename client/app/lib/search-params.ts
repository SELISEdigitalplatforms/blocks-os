/** Read and trim a single query param; empty/missing becomes `""`. */
export const getTrimmedSearchParam = (params: URLSearchParams, key: string) =>
  params.get(key)?.trim() ?? ""

/** Read and trim; missing or blank becomes `undefined` (optional props). */
export const getOptionalSearchParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key)?.trim()
  return value ? value : undefined
}
