/**
 * Types for the feature registry in `../features.cjs` (single source of truth).
 * Keep ids/specs in sync when adding features — edit features.cjs, not this file.
 */
export type OsFeature = {
  id: string
  name: string
  enabled: boolean
  spec: string
}
