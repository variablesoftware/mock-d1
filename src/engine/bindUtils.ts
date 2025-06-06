/**
 * @file engine/bindUtils.ts
 * @description Centralized bind parameter validation for D1 mock.
 */

/**
 * Validates that all required bind parameters are present in the args object.
 * Throws if any are missing.
 * @param required - Array of required parameter names.
 * @param args - The bind arguments object.
 */
export function validateBindArgs(required: string[], args: Record<string, unknown>): void {
  for (const param of required) {
    if (!(param in args)) {
      throw new Error('Missing bind argument: ' + param);
    }
  }
}
