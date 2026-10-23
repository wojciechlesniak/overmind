// Public seed; ARCH008/009 replace this wiring with their generated barrel.
export * from "./kernel/result.ts";
export * from "./kernel/app-error.ts";
export * from "./errors/define-errors.ts";
export * from "./errors/registry.ts";
export * from "./errors/index.generated.ts";
export * from "./errors/user-message.ts";
export * from "./errors/error-response.ts";
export {
  validateDetails,
  isSafeText,
  sanitisedText,
  sanitisedRelativePath,
} from "./errors/safe-details.ts";
export * from "./kernel/ids.ts";
