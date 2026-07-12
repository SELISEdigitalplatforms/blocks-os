/**
 * Logical modules of the Blocks OS platform. Used as the `moduleName` field
 * on uploaded assets (logo, profile image, certificate, ...) so the backend
 * can route them to the correct storage container.
 */
export enum ModuleName {
  /** Cloud (umbrella) module. */
  Cloud = 1,
  /** Construct (umbrella) module. */
  Construct = 2,
  /** Default cloud storage / branding. */
  DefaultCloud = 3,
  /** AI cloud branding assets. */
  AICloud = 4,
  /** IAM cloud branding assets. */
  IAMCloud = 5,
  /** Localization cloud branding assets. */
  Localization = 6,
  /** Logging, Monitoring and Tracing module assets. */
  LMT = 7,
  /** Default construct storage / branding. */
  DefaultConstruct = 8,
  /** AI construct branding assets. */
  AIConstruct = 9,
  /** IAM construct branding assets. */
  IAMConstruct = 10,
  /** Data gateway module assets. */
  DataGateway = 11,
}
