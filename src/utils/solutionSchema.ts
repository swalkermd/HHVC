/**
 * Solution Schema Validation
 *
 * Zod-based schema validation for AI JSON responses.
 * Validates immediately after parseAIResponse() and before any formatting.
 *
 * CRITICAL: If validation fails:
 * 1. Log/store raw AI response for debugging
 * 2. Return structured error for clean UI error state
 * 3. Caller should trigger retry/re-request (do not attempt to format invalid payloads)
 */

import { z } from "zod/v4";

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

/**
 * Schema for a single solution step from AI response.
 * Validates the raw AI output structure before any formatting.
 */
export const SolutionStepSchema = z.object({
  title: z.string().min(1, "Step title is required"),
  equation: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  explanation: z.string().optional(),
});

/**
 * Schema for the final answer field.
 * Supports both string format and parts array format.
 */
export const FinalAnswerSchema = z.union([
  z.string().min(1, "Final answer cannot be empty"),
  z.object({
    parts: z.array(z.string()).min(1, "Final answer parts cannot be empty"),
  }),
]);

/**
 * Schema for the complete parsed AI solution.
 * This validates the RAW AI output, before any formatting is applied.
 */
export const ParsedAISolutionSchema = z.object({
  problem: z.string().min(1, "Problem statement is required"),
  steps: z
    .array(SolutionStepSchema)
    .min(1, "At least one solution step is required"),
  finalAnswer: FinalAnswerSchema,
});

// ============================================================================
// TYPE EXPORTS (inferred from schemas)
// ============================================================================

export type ValidatedSolutionStep = z.infer<typeof SolutionStepSchema>;
export type ValidatedFinalAnswer = z.infer<typeof FinalAnswerSchema>;
export type ValidatedParsedSolution = z.infer<typeof ParsedAISolutionSchema>;

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationSuccess {
  success: true;
  data: ValidatedParsedSolution;
}

export interface ValidationFailure {
  success: false;
  errors: string[];
  rawPayload: unknown;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate a parsed AI response against the solution schema.
 *
 * CRITICAL: Call this immediately after parseAIResponse() and BEFORE any formatting.
 * If validation fails, do NOT attempt to format - return error to caller.
 *
 * @param parsed - The parsed JSON object from AI response
 * @returns ValidationResult with either validated data or structured errors
 */
export function validateParsedSolution(parsed: unknown): ValidationResult {
  const result = ParsedAISolutionSchema.safeParse(parsed);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  // Extract human-readable error messages
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });

  // Log for debugging
  console.log("[Schema Validation] FAILED:", errors);
  console.log("[Schema Validation] Raw payload:", JSON.stringify(parsed, null, 2).substring(0, 1000));

  return {
    success: false,
    errors,
    rawPayload: parsed,
  };
}

/**
 * Quick check if a payload looks like it might be a valid solution structure.
 * This is a lightweight pre-check before full validation.
 *
 * @param payload - Unknown payload to check
 * @returns true if payload has basic solution structure
 */
export function looksLikeSolution(payload: unknown): payload is Record<string, unknown> {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const obj = payload as Record<string, unknown>;
  return (
    typeof obj.problem === "string" &&
    Array.isArray(obj.steps) &&
    (typeof obj.finalAnswer === "string" ||
      (typeof obj.finalAnswer === "object" && obj.finalAnswer !== null))
  );
}

/**
 * Format validation errors for display in UI.
 * Returns a user-friendly error message.
 */
export function formatValidationErrorForUI(result: ValidationFailure): string {
  if (result.errors.length === 0) {
    return "The AI response was invalid. Please try again.";
  }

  if (result.errors.length === 1) {
    return `Invalid response: ${result.errors[0]}`;
  }

  return `Invalid response with ${result.errors.length} issues. Please try again.`;
}

// ============================================================================
// STORAGE FOR DEBUGGING (in-memory, last N failures)
// ============================================================================

const MAX_STORED_FAILURES = 5;
const storedFailures: Array<{
  timestamp: Date;
  errors: string[];
  rawPayload: unknown;
}> = [];

/**
 * Store a validation failure for debugging purposes.
 * Keeps only the last N failures in memory.
 */
export function storeValidationFailure(result: ValidationFailure): void {
  storedFailures.push({
    timestamp: new Date(),
    errors: result.errors,
    rawPayload: result.rawPayload,
  });

  // Keep only last N
  while (storedFailures.length > MAX_STORED_FAILURES) {
    storedFailures.shift();
  }
}

/**
 * Get stored validation failures for debugging.
 */
export function getStoredValidationFailures(): typeof storedFailures {
  return [...storedFailures];
}

/**
 * Clear stored validation failures.
 */
export function clearStoredValidationFailures(): void {
  storedFailures.length = 0;
}
