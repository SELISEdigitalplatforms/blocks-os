import { tStatic } from "@seliseblocks/genesis-os";

/**
 * Runtime topology of a service registered with the platform's identifier
 * (service registry). Mirrors the backend `BlocksManagedServiceType` enum.
 */
export enum REGISTER_SERVICE_TYPE {
  /** Service has no type assigned. */
  None = 0,
  /** HTTP API service. */
  Api = 1,
  /** Background worker that consumes queued jobs. */
  Worker = 2,
}

export const getRegisterServiceTypes = (): { value: REGISTER_SERVICE_TYPE; label: string }[] => [
  { value: REGISTER_SERVICE_TYPE.None, label: tStatic("os.identifier", "CONSTANTS.NONE") },
  { value: REGISTER_SERVICE_TYPE.Api, label: "API" },
  { value: REGISTER_SERVICE_TYPE.Worker, label: tStatic("os.identifier", "CONSTANTS.WORKER") },
];

export const getRegisterServiceEnvironments = () => [
  { value: "prod", label: tStatic("os.identifier", "CONSTANTS.PRODUCTION") },
  { value: "stg", label: tStatic("os.identifier", "CONSTANTS.STAGING") },
  { value: "dev", label: tStatic("os.identifier", "CONSTANTS.DEVELOPMENT") },
];

export const getLogLevels = () => [
  { value: "debug", label: tStatic("os.identifier", "CONSTANTS.DEBUG"), color: "bg-gray-500" },
  { value: "info", label: tStatic("os.identifier", "CONSTANTS.INFO"), color: "bg-blue-500" },
  { value: "warn", label: tStatic("os.identifier", "CONSTANTS.WARNING"), color: "bg-yellow-500" },
  { value: "error", label: tStatic("os.identifier", "common:ERROR"), color: "bg-red-500" },
  { value: "fatal", label: tStatic("os.identifier", "CONSTANTS.FATAL"), color: "bg-red-700" },
] as const;

export const getServiceStatus = () => [
  { value: "active", label: tStatic("os.identifier", "CONSTANTS.ACTIVE"), color: "bg-green-500" },
  { value: "inactive", label: tStatic("os.identifier", "CONSTANTS.INACTIVE"), color: "bg-gray-500" },
  { value: "error", label: tStatic("os.identifier", "common:ERROR"), color: "bg-red-500" },
] as const;

export const getTraceStatus = () => [
  { value: "ok", label: tStatic("os.identifier", "common:SUCCESS"), color: "bg-green-500" },
  { value: "error", label: tStatic("os.identifier", "common:ERROR"), color: "bg-red-500" },
  { value: "timeout", label: tStatic("os.identifier", "CONSTANTS.TIMEOUT"), color: "bg-yellow-500" },
] as const;
