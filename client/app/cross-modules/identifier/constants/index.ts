import { tStatic } from "@seliseblocks/genesis-os";

const KEY_COMMON_ERROR = "common:ERROR";

const I18N_MODULE = "os.identifier";

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
  { value: REGISTER_SERVICE_TYPE.None, label: tStatic(I18N_MODULE, "CONSTANTS.NONE") },
  { value: REGISTER_SERVICE_TYPE.Api, label: "API" },
  { value: REGISTER_SERVICE_TYPE.Worker, label: tStatic(I18N_MODULE, "CONSTANTS.WORKER") },
];

export const getRegisterServiceEnvironments = () => [
  { value: "prod", label: tStatic(I18N_MODULE, "CONSTANTS.PRODUCTION") },
  { value: "stg", label: tStatic(I18N_MODULE, "CONSTANTS.STAGING") },
  { value: "dev", label: tStatic(I18N_MODULE, "CONSTANTS.DEVELOPMENT") },
];

export const getLogLevels = () =>
  [
    { value: "debug", label: tStatic(I18N_MODULE, "CONSTANTS.DEBUG"), color: "bg-gray-500" },
    { value: "info", label: tStatic(I18N_MODULE, "CONSTANTS.INFO"), color: "bg-blue-500" },
    { value: "warn", label: tStatic(I18N_MODULE, "CONSTANTS.WARNING"), color: "bg-yellow-500" },
    { value: "error", label: tStatic(I18N_MODULE, KEY_COMMON_ERROR), color: "bg-red-500" },
    { value: "fatal", label: tStatic(I18N_MODULE, "CONSTANTS.FATAL"), color: "bg-red-700" },
  ] as const;

export const getServiceStatus = () =>
  [
    { value: "active", label: tStatic(I18N_MODULE, "CONSTANTS.ACTIVE"), color: "bg-green-500" },
    { value: "inactive", label: tStatic(I18N_MODULE, "CONSTANTS.INACTIVE"), color: "bg-gray-500" },
    { value: "error", label: tStatic(I18N_MODULE, KEY_COMMON_ERROR), color: "bg-red-500" },
  ] as const;

export const getTraceStatus = () =>
  [
    { value: "ok", label: tStatic(I18N_MODULE, "common:SUCCESS"), color: "bg-green-500" },
    { value: "error", label: tStatic(I18N_MODULE, KEY_COMMON_ERROR), color: "bg-red-500" },
    { value: "timeout", label: tStatic(I18N_MODULE, "CONSTANTS.TIMEOUT"), color: "bg-yellow-500" },
  ] as const;
