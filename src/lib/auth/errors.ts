export type AuthErrorCode = "UNAUTHENTICATED" | "MFA_REQUIRED" | "FORBIDDEN";

/**
 * Thrown by requireUser / requireAal2 / requirePermission. Server Actions turn it
 * into a generic message; its code never reveals internal details (docs/05 §12, A10).
 */
export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
