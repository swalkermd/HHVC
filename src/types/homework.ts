export interface HomeworkImage {
  uri: string;
  width: number;
  height: number;
}

export interface SelectedProblem {
  imageUri: string;
  problemArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Content kind classification for routing to appropriate formatters.
 * This prevents math-specific transforms from mangling non-math content.
 *
 * - "math": Equations, calculations, algebraic expressions
 * - "prose": Paragraph explanations, analysis, essays
 * - "list": Multiple choice (A-D), numbered lists, bullet points
 * - "code": Code blocks, programming content
 */
export type ContentKind = "math" | "prose" | "list" | "code";

/**
 * Step action types for pedagogical badges.
 * These help students understand what mathematical operation is being performed.
 */
export type StepAction =
  | "rewrite"
  | "distribute"
  | "combine_like_terms"
  | "simplify"
  | "add_subtract_both_sides"
  | "multiply_divide_both_sides"
  | "isolate_variable"
  | "factor"
  | "substitute"
  | "evaluate"
  | "check"
  | "final";

/**
 * Type of both-sides operation being performed.
 * Used to display visual indicators of operations applied equally to both sides.
 */
export type BothSidesOpType = "add" | "subtract" | "multiply" | "divide";

/**
 * Represents an operation applied to both sides of an equation.
 * Used to render visual feedback like "+ 11 = + 11" showing
 * what was done to maintain equation balance.
 */
export interface BothSidesOperation {
  type: BothSidesOpType;
  value: string; // e.g., "11", "3", "{1/2}", "*x*"
}

export interface SolutionStep {
  id: string;
  title: string;
  equation?: string; // The mathematical work (formatted for display)
  rawEquation?: string; // Raw equation before formatting (debug/fallback only)
  equationKind?: ContentKind; // What type of content is in equation field
  content?: string; // Legacy field, kept for backwards compatibility
  summary?: string; // Plain English explanation
  summaryKind?: ContentKind; // What type of content is in summary field
  explanation?: string; // Detailed explanation for simplified mode
  explanationKind?: ContentKind; // What type of content is in explanation field
  latex?: string;
  code?: string;
  action?: StepAction; // Inferred action type for pedagogical badge
  actionLabel?: string; // Human-friendly label for UI display
  bothSidesOp?: BothSidesOperation; // Operation applied to both sides (for visual feedback)
}

export interface HomeworkSolution {
  problem: string;
  steps: SolutionStep[];
  finalAnswer: string | { parts: string[] }; // Support both old string format and new parts array
}
