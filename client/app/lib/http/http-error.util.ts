export const isHttpErrorStatus = (error: unknown, status: number): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number" &&
    (error as { status: number }).status === status
  )
}
