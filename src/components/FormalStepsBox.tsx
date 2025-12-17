import React, { useState, useEffect } from "react";
import { View, Text, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MathText } from "./MathText";
import { SolutionStep, BothSidesOperation } from "../types/homework";
import {
  responsive,
  responsiveSpacing,
  responsiveTypography,
  isPortrait,
} from "../utils/responsive";
import { formatEquationText, normalizeEquationBlockForExtraction, stripMarkdownEmphasis, stripDanglingAsterisks, normalizeAsterisks } from "../utils/contentFormatter";

interface FormalStepsBoxProps {
  steps: SolutionStep[];
}

// ============================================================================
// STEP ACTION BADGE COMPONENT
// ============================================================================

/**
 * StepActionBadge - Displays a pedagogical badge indicating what action is being performed.
 * Helps students understand the purpose of each transformation at a glance.
 */
function StepActionBadge({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: "rgba(14, 165, 233, 0.15)", // Light sky blue
        marginBottom: 6,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "600", color: "#0369a1" }}>{label}</Text>
    </View>
  );
}

// ============================================================================
// BOTH SIDES OPERATION ROW COMPONENT
// ============================================================================

/**
 * Map operation types to display symbols.
 */
const OP_SYMBOLS: Record<BothSidesOperation["type"], string> = {
  add: "+",
  subtract: "−", // Using proper minus sign
  multiply: "×",
  divide: "÷",
};

/**
 * BothSidesOpRow - Displays the operation applied to both sides of an equation.
 * Shows a visual row like "+ 11 = + 11" to reinforce equation balance.
 *
 * @param op - The both-sides operation to display
 * @param isPortraitMode - Whether we're in portrait orientation
 */
function BothSidesOpRow({
  op,
  isPortraitMode,
}: {
  op: BothSidesOperation;
  isPortraitMode: boolean;
}) {
  const symbol = OP_SYMBOLS[op.type];
  const displayValue = `${symbol} ${op.value}`;

  // Responsive sizing
  const fontSize = isPortraitMode ? 12 : 14;
  const paddingV = isPortraitMode ? 4 : 6;
  const marginLeft = isPortraitMode ? 26 : 32; // Align with equation content (after step number)

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginLeft,
        marginTop: 4,
        marginBottom: 4,
        paddingVertical: paddingV,
        backgroundColor: "rgba(34, 197, 94, 0.08)", // Very subtle green
        borderRadius: 8,
      }}
    >
      {/* Left side operation */}
      <View style={{ flex: 1, alignItems: "flex-end", paddingRight: 8 }}>
        <MathText size={isPortraitMode ? "small" : "medium"}>
          {displayValue}
        </MathText>
      </View>

      {/* Equals sign */}
      <Text
        style={{
          fontSize,
          fontWeight: "600",
          color: "#16a34a", // Green for balance emphasis
          paddingHorizontal: 4,
        }}
      >
        =
      </Text>

      {/* Right side operation (same as left) */}
      <View style={{ flex: 1, alignItems: "flex-start", paddingLeft: 8 }}>
        <MathText size={isPortraitMode ? "small" : "medium"}>
          {displayValue}
        </MathText>
      </View>
    </View>
  );
}

// ============================================================================
// EQUATION EXTRACTION HELPERS (Recommendation 6)
// ============================================================================

/**
 * Regex to match common label prefixes that appear before equations.
 * These are stripped before extracting equation candidates.
 */
const LABEL_PREFIX_RE =
  /^(?:left side|right side|lhs|rhs|equation(?: after simplifying(?: both sides)?)?|result|final answer|simplified|original equation|therefore|hence|thus)\s*:\s*/i;

/**
 * Strip leading label prefix from a line.
 * Example: "Left Side: 2x + 3 = 7" → "2x + 3 = 7"
 */
function stripLeadingLabel(line: string): string {
  return line.replace(LABEL_PREFIX_RE, "").trim();
}

/**
 * CRITICAL FIX 2: Validate equation candidates before adding to display.
 * Rejects malformed equations that would render as garbage.
 *
 * Examples of INVALID equations:
 *   "4 - 1/2 × x x* +" (ends with operator, has dangling asterisk)
 *   "x = 7/5 × x*" (has dangling asterisk)
 *   "... +" (ends with operator)
 *   "=" (empty sides)
 *   "x = {7/2} × {2/5} x" (multiplication at end - should be simplified)
 *   "{5/2}x = {9/2} - 1 {5/2} x" (duplicate term at end)
 *   "× x x" (duplicate variables from asterisk corruption)
 *
 * @param eq - The equation candidate to validate
 * @returns true if the equation is valid and should be rendered
 */
function isValidEquationCandidate(eq: string): boolean {
  // CRITICAL: Normalize asterisks FIRST to clean up corruption before validation
  const s = normalizeAsterisks(eq ?? "").trim();

  // Must contain an equals sign
  if (!s.includes("=")) return false;

  // Reject equations ending with an operator or dangling star
  if (/[+\-×÷*/]\s*$/.test(s)) return false;
  if (/\*\s*$/.test(s)) return false;

  // Reject equations with dangling asterisks mid-string (like "× x*")
  if (/\*(?=\s|[+\-×÷*/=)])/.test(s)) return false;

  // CRITICAL: Reject obvious corruption - duplicated variable tokens like "x x"
  // This catches patterns like "× x x" from broken "*x*" handling
  if (/\b([A-Za-z])\s+\1\b/.test(s)) return false;

  // Find the equals sign and check both sides
  const i = s.indexOf("=");
  const L = s.slice(0, i).trim();
  const R = s.slice(i + 1).trim();

  // Reject if either side is empty
  if (!L || !R) return false;

  // Require something meaningful on the right side (digit, letter, or fraction opening)
  if (!/[0-9A-Za-z{(]/.test(R)) return false;

  // Reject if right side starts with an operator (incomplete equation)
  if (/^[+×÷*/]/.test(R)) return false;

  // CRITICAL: Reject equations where the right side ends with "× {fraction} variable"
  // This pattern indicates an incomplete multiplication that should be simplified
  // Example: "x = {7/2} × {2/5} x" should be rejected - the answer is {7/5}, not a multiplication
  if (/×\s*\{[^}]+\}\s*[a-zA-Z]\s*$/.test(R)) return false;

  // CRITICAL: Reject equations with duplicate terms at the end
  // Example: "{5/2}x = {9/2} - 1 {5/2} x" has "{5/2} x" duplicated
  // Pattern: If we have both a term like "{5/2}x" on left AND "{5/2} x" at end of right, reject
  const leftFractionVar = L.match(/\{([^}]+)\}\s*([a-zA-Z])/);
  const rightEndFractionVar = R.match(/\{([^}]+)\}\s*([a-zA-Z])\s*$/);
  if (leftFractionVar && rightEndFractionVar) {
    // If the fraction and variable match, this is a duplicate term
    if (leftFractionVar[1] === rightEndFractionVar[1] &&
        leftFractionVar[2].toLowerCase() === rightEndFractionVar[2].toLowerCase()) {
      return false;
    }
  }

  return true;
}

/**
 * Extract equation candidates from a single line using deterministic parsing.
 *
 * This handles complex cases like:
 * - "Left Side: 6x - 11 = x + 17" (labeled equations)
 * - "6x - 15 + 4 → 6x - 11" (arrow-separated transforms, but no '=')
 * - "A = B → C = D" (multiple equations with arrows)
 * - Lines with multiple "=" patterns
 *
 * Returns an array of equation candidates found in the line.
 */
function extractEquationCandidatesFromLine(lineRaw: string): string[] {
  let line = stripLeadingLabel(lineRaw);

  // If the line contains multiple transforms via arrows, split and process each segment
  // This handles "6x - 15 + 4 → 6x - 11" or "A = B → C = D"
  const segments = line
    .split(/(?:→|->|=>|⟶|⟹)/g)
    .map(s => s.trim())
    .filter(Boolean);

  const candidates: string[] = [];

  for (const seg of segments.length ? segments : [line]) {
    // Find all "…=…" patterns inside the segment
    // This handles cases like "Left: 6x - 11 = x + 17  Right: ..." on one line
    const matches = seg.match(/[^=]+=[^=]+/g);
    if (!matches) continue;

    for (const m of matches) {
      const eq = m.trim();

      // Reject obvious garbage - incomplete equations
      if (eq.startsWith("=") || eq.endsWith("=")) continue;

      const idx = eq.indexOf("=");
      const L = eq.slice(0, idx).trim();
      const R = eq.slice(idx + 1).trim();

      if (!L || !R) continue;

      // Require at least some "mathy" content on the right side (digit or letter)
      if (!/[0-9A-Za-z]/.test(R)) continue;

      candidates.push(eq);
    }
  }

  // De-duplicate while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of candidates) {
    const key = c.replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

/**
 * Post-process normalized equation text for extraction purposes.
 * This applies extraction-specific cleanup AFTER centralized normalization.
 *
 * NOTE: The heavy lifting (joining broken lines, fixing delimiters, label isolation)
 * is done by normalizeEquationBlockForExtraction from contentFormatter.
 * This function only does extraction-specific cleanup like stripping color tags.
 */
function prepareForExtraction(input: string): string {
  // Use the centralized normalization first
  let t = normalizeEquationBlockForExtraction(input);

  // Strip ALL color tags but keep their content (for equation comparison/dedup)
  t = t.replace(/\[(?:red|blue|green|orange|purple|yellow|teal|indigo|pink):([^\]]+)\]/gi, "$1");

  // NOTE: We no longer strip arrows here - extractEquationCandidatesFromLine uses them
  // to split transform chains like "A = B → C = D"

  // Normalize horizontal whitespace (but preserve newlines for line splitting)
  t = t.replace(/[ \t]+/g, " ");

  return t;
}

/**
 * Extracts ALL equations from a step's equation field using deterministic parsing.
 *
 * This replaces the old heuristic-based approach with robust candidate extraction
 * that handles:
 * - Labeled equations: "Left Side: 2x + 3 = 7"
 * - Arrow-separated transforms: "6x - 15 + 4 → 6x - 11"
 * - Multiple equations per line
 * - Equations with any variable (not just x/y)
 *
 * Returns an array of equations found in the step, in order.
 */
function extractAllEquations(equationText: string | undefined): string[] {
  if (!equationText) return [];

  // CRITICAL: Skip content that contains image markers - these are not equations
  const hasImageMarker = equationText.includes("[IMAGE NEEDED:") ||
                         equationText.includes("[IMAGE:") ||
                         /\[IMAGE:[^\]]*\]\([^)]+\)/.test(equationText);

  if (hasImageMarker) {
    // Check if there's actual equation content AFTER the image marker
    let afterImage = "";
    const processedImageMatch = equationText.match(/\[IMAGE:[^\]]*\]\([^)]+\)/);
    if (processedImageMatch) {
      const endIndex = equationText.indexOf(processedImageMatch[0]) + processedImageMatch[0].length;
      afterImage = equationText.substring(endIndex).trim();
    } else {
      const imageEndIndex = equationText.lastIndexOf("]");
      if (imageEndIndex !== -1 && imageEndIndex < equationText.length - 1) {
        afterImage = equationText.substring(imageEndIndex + 1).trim();
      }
    }
    if (afterImage && afterImage.includes("=")) {
      return extractAllEquations(afterImage);
    }
    return [];
  }

  // CRITICAL FIX 1: Strip markdown emphasis BEFORE any other processing
  // This ensures *x* tokens don't corrupt equation extraction
  let cleanedInput = stripMarkdownEmphasis(equationText);
  cleanedInput = stripDanglingAsterisks(cleanedInput);

  // CRITICAL: Use centralized normalization BEFORE splitting into lines
  const normalized = prepareForExtraction(cleanedInput);

  const equations: string[] = [];
  const lines = normalized.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Skip pure labels that end with colon and have no equation content
    // But DON'T skip labeled equations - extractEquationCandidatesFromLine handles those
    if (/^[A-Za-z][A-Za-z ]*:\s*$/.test(line)) continue;

    // Skip lines that are clearly explanatory prose (no equation content)
    const lowerLine = line.toLowerCase();
    if (
      !line.includes("=") && (
        lowerLine.startsWith("where") ||
        lowerLine.startsWith("since") ||
        lowerLine.startsWith("because") ||
        lowerLine.startsWith("note") ||
        lowerLine.startsWith("this") ||
        lowerLine.startsWith("we ") ||
        lowerLine.startsWith("the ") ||
        lowerLine.startsWith("let ")
      )
    ) {
      continue;
    }

    // Use deterministic candidate extraction
    const candidates = extractEquationCandidatesFromLine(line);
    for (const c of candidates) {
      // CRITICAL FIX 2: Clean and validate before adding
      const cleaned = stripDanglingAsterisks(stripMarkdownEmphasis(c));
      if (isValidEquationCandidate(cleaned)) {
        equations.push(cleaned);
      }
    }
  }

  // Final de-dupe across the full step
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of equations) {
    const key = e.replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }

  return out;
}

/**
 * Extracts the final/result equation from a step's equation field.
 *
 * This returns the "most final" equation - typically the last one in the step,
 * which is usually the most simplified form. This prevents the classic bug
 * where an earlier, less-simplified equation is extracted.
 */
function extractEquation(equationText: string | undefined): string | null {
  const all = extractAllEquations(equationText);
  if (!all.length) return null;

  // Prefer the last equation (usually the most simplified/final)
  return all[all.length - 1];
}

/**
 * Cleans equation text for display in the formal steps box
 * Uses the centralized formatEquationText for robust handling of
 * newlines inside parentheses, fraction normalization, etc.
 */
function cleanEquationForDisplay(equation: string): string {
  let result = formatEquationText(equation);

  // Convert (expression)/number patterns to proper fraction syntax
  // e.g., "(x - 1)/2" → "{x - 1/2}" (proper fraction)
  // This handles patterns like (x-1)/2, (3x+5)/4, etc.
  result = result.replace(/\(([^)]+)\)\/(\d+)/g, "{$1/$2}");

  // Also handle expression/number without parens when it's clearly a fraction
  // e.g., "1/2" → "{1/2}" if not already in braces
  // But be careful not to double-convert existing {num/den} patterns
  result = result.replace(/(?<!\{)(\d+)\/(\d+)(?!\})/g, "{$1/$2}");

  return result;
}

/**
 * Splits equation into left and right parts around the equals sign
 * For chained equations like "a = b = c", splits on the FIRST equals
 * to show the full progression on the right side
 *
 * IMPORTANT: For portrait mode, we only split simple equations.
 * Complex equations with multiple "=" or long right sides are displayed as a single line.
 */
function splitEquation(equation: string, forPortrait: boolean = false): { left: string; right: string } | null {
  // Find the FIRST equals sign to capture the full chain
  // e.g., "*m* = {150/3} = 50" becomes left: "*m*", right: "{150/3} = 50"
  const equalsIndex = equation.indexOf("=");
  if (equalsIndex === -1) return null;

  // Check if this is a comparison operator (==, !=, <=, >=)
  const beforeEquals = equalsIndex > 0 ? equation[equalsIndex - 1] : "";
  const afterEquals = equalsIndex < equation.length - 1 ? equation[equalsIndex + 1] : "";

  if (beforeEquals === "=" || beforeEquals === "!" || beforeEquals === "<" || beforeEquals === ">") {
    return null;
  }
  if (afterEquals === "=") {
    // This might be "==" - try to find next single "="
    const nextEquals = equation.indexOf("=", equalsIndex + 2);
    if (nextEquals !== -1) {
      const left = equation.substring(0, nextEquals).trim();
      const right = equation.substring(nextEquals + 1).trim();
      if (left && right) return { left, right };
    }
    return null;
  }

  const left = equation.substring(0, equalsIndex).trim();
  const right = equation.substring(equalsIndex + 1).trim();

  if (!left || !right) return null;

  // For portrait mode, skip splitting if:
  // 1. The right side contains multiple "=" (chained equations)
  // 2. The right side is too long (will wrap badly)
  // 3. The equation contains complex patterns like √() or long text
  // 4. The equation contains fractions {num/den} (they render wider than character count suggests)
  // 5. The equation contains color tags [color:...] (variable-width content)
  // 6. The equation contains arrows → (need full width for visual flow)
  if (forPortrait) {
    const hasMultipleEquals = right.includes("=");
    const isTooLong = right.length > 25 || left.length > 15;
    const hasComplexPatterns = equation.includes("√") || equation.includes("opposite") || equation.includes("adjacent");
    // CRITICAL: Fractions render much wider than their character count
    // e.g., "{2/3}" is 5 chars but renders as a stacked fraction taking more horizontal space
    const hasFractions = equation.includes("{") && equation.includes("/") && equation.includes("}");
    // Also check for parenthesized expressions that might be complex
    const hasComplexParens = /\([^)]{10,}\)/.test(equation);
    // Color tags indicate highlighted content which may contain complex elements
    const hasColorTags = /\[(?:red|blue|green|orange|purple|yellow|teal|indigo|pink):/i.test(equation);
    // Arrows need full width for proper visual flow
    const hasArrows = equation.includes("→") || equation.includes("->");

    if (hasMultipleEquals || isTooLong || hasComplexPatterns || hasFractions || hasComplexParens || hasColorTags || hasArrows) {
      return null; // Don't split - will be rendered as single line
    }
  }

  return { left, right };
}

/**
 * FormalStepsBox - Displays solution equations in a clean, vertically-aligned format
 *
 * This component extracts the key equations from each solution step and displays them
 * in a formal, easy-to-follow format with equal signs perfectly aligned vertically.
 * Designed for students who need to show their work in a clear, organized manner.
 *
 * Fully responsive for both portrait (iPhone) and landscape orientations.
 */
export function FormalStepsBox({ steps }: FormalStepsBoxProps) {
  // Track orientation changes
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    isPortrait() ? "portrait" : "landscape"
  );

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setOrientation(window.width > window.height ? "landscape" : "portrait");
    });

    return () => subscription?.remove();
  }, []);

  // Get responsive values based on current orientation
  const isPortraitMode = orientation === "portrait";

  // Responsive sizing
  const headerFontSize = isPortraitMode ? 14 : 18;
  const subtitleFontSize = isPortraitMode ? 11 : 13;
  const stepNumberSize = isPortraitMode ? 18 : 24;
  const stepNumberFontSize = isPortraitMode ? 10 : 12;
  const equalsFontSize = isPortraitMode ? 14 : 20;
  const hintFontSize = isPortraitMode ? 10 : 12;
  const headerIconSize = isPortraitMode ? 14 : 18;
  const headerBadgeSize = isPortraitMode ? 24 : 32;

  // Responsive spacing
  const containerPadding = responsiveSpacing.xl;
  const headerPaddingV = responsiveSpacing.md;
  const headerPaddingH = responsiveSpacing.xl;
  const equationGap = responsiveSpacing.lg;
  const equationPaddingV = responsiveSpacing.sm;
  const stepNumberMargin = responsiveSpacing.md;
  const equalsWidth = isPortraitMode ? 18 : 24;
  const equalsPaddingH = isPortraitMode ? 4 : 8;

  // Math text size for equations
  const mathSize: "small" | "medium" | "large" = isPortraitMode ? "small" : "medium";

  // ============================================================================
  // STEP 7: Deterministic step numbering (Recommendation 7)
  // ============================================================================
  // Build a flattened list of display rows, but PRESERVE the original step number
  // for each row. This prevents "skipped" or "incorrect" step numbers when:
  // - A step yields multiple equations (all share the same step number)
  // - A step yields 0 equations (we show prose content instead)
  // - Equations are deduplicated across steps

  // DEV INVARIANT: Catch invalid steps array early
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    if (!Array.isArray(steps)) {
      console.error("[FormalStepsBox] steps must be an array");
    }
    steps.forEach((s, i) => {
      if (!s) {
        console.error(`[FormalStepsBox] Missing step at index ${i}`);
      }
    });
  }

  // Define row types for the flattened display list
  type DisplayRow = {
    stepNum: number;           // Original step number (1-indexed, stable)
    type: "equation" | "prose";
    equation?: string;
    left?: string;
    right?: string;
    isSingleLine?: boolean;
    proseText?: string;
    actionLabel?: string;      // Pedagogical badge label for this step
    isFirstRowOfStep?: boolean; // Whether this is the first row for its step (for badge display)
    bothSidesOp?: BothSidesOperation; // Operation applied to both sides (for visual feedback)
  };

  const displayRows: DisplayRow[] = [];
  const seenEquations = new Set<string>(); // Track seen equations to prevent duplicates
  let lastStepNum = 0; // Track last step number to know when we're on first row of a new step
  let equationRowCounter = 0; // CRITICAL: Sequential counter for equation row numbering

  steps.forEach((step, index) => {
    // CRITICAL: displayStepNumber is STABLE and deterministic
    const displayStepNumber = index + 1;
    const stepActionLabel = step.actionLabel;
    const stepBothSidesOp = step.bothSidesOp; // Get both-sides operation for this step

    // CRITICAL: Prefer already-formatted content (equation) over raw unformatted text
    // rawEquation contains unformatted text with potential MASK tokens, LIST_BREAK markers, etc.
    // Using equation first ensures we operate on post-formatSolution() output
    const rawText = step.equation || step.content || step.rawEquation;

    // Extract ALL equations from this step (for showing complete work)
    const allEqs = extractAllEquations(rawText);
    console.log(`[FormalStepsBox] Step ${displayStepNumber} found ${allEqs.length} equations:`, allEqs);

    let isFirstRow = true; // Track if this is the first row for this step

    if (allEqs.length > 0) {
      // Add all equations from this step, each with SEQUENTIAL row number
      allEqs.forEach((eq) => {
        const cleaned = cleanEquationForDisplay(eq);

        // CRITICAL: Detect and fix duplicated content like "x = -11 x = -11"
        // This happens when the AI includes the answer twice in one line
        const duplicatePattern = /^(.+?=.+?)\s+\1$/;
        let finalCleaned = cleaned;
        const dupMatch = cleaned.match(duplicatePattern);
        if (dupMatch) {
          finalCleaned = dupMatch[1].trim();
        }

        // Also check for pattern like "x = -11 x = -11" where variable repeats
        const repeatPattern = /^(\w+)\s*=\s*(-?\d+)\s+\1\s*=\s*\2$/;
        const repeatMatch = finalCleaned.match(repeatPattern);
        if (repeatMatch) {
          finalCleaned = `${repeatMatch[1]} = ${repeatMatch[2]}`;
        }

        // Skip if we've already seen this equation (deduplication)
        const normalizedEq = finalCleaned.replace(/\s+/g, " ").trim().toLowerCase();
        if (seenEquations.has(normalizedEq)) {
          return;
        }
        seenEquations.add(normalizedEq);

        // CRITICAL: Increment equation row counter for each new equation row
        equationRowCounter++;

        const split = splitEquation(finalCleaned, isPortraitMode);

        if (split) {
          displayRows.push({
            stepNum: equationRowCounter, // Use sequential row number, not step index
            type: "equation",
            equation: finalCleaned,
            left: split.left,
            right: split.right,
            isSingleLine: false,
            actionLabel: isFirstRow ? stepActionLabel : undefined,
            isFirstRowOfStep: isFirstRow,
            bothSidesOp: isFirstRow ? stepBothSidesOp : undefined, // Only show on first row
          });
          isFirstRow = false;
        } else if (finalCleaned.includes("=")) {
          displayRows.push({
            stepNum: equationRowCounter, // Use sequential row number, not step index
            type: "equation",
            equation: finalCleaned,
            left: "",
            right: "",
            isSingleLine: true,
            actionLabel: isFirstRow ? stepActionLabel : undefined,
            isFirstRowOfStep: isFirstRow,
            bothSidesOp: isFirstRow ? stepBothSidesOp : undefined, // Only show on first row
          });
          isFirstRow = false;
        } else {
          // Equation didn't have = and wasn't split - decrement counter
          equationRowCounter--;
        }
      });
    } else {
      // No equations found - fall back to extracting just the final equation
      const extracted = extractEquation(rawText);
      console.log(`[FormalStepsBox] Step ${displayStepNumber} fallback extracted:`, extracted);

      if (extracted) {
        const cleaned = cleanEquationForDisplay(extracted);

        // Apply same duplicate detection
        let finalCleaned = cleaned;
        const duplicatePattern = /^(.+?=.+?)\s+\1$/;
        const dupMatch = cleaned.match(duplicatePattern);
        if (dupMatch) {
          finalCleaned = dupMatch[1].trim();
        }
        const repeatPattern = /^(\w+)\s*=\s*(-?\d+)\s+\1\s*=\s*\2$/;
        const repeatMatch = finalCleaned.match(repeatPattern);
        if (repeatMatch) {
          finalCleaned = `${repeatMatch[1]} = ${repeatMatch[2]}`;
        }

        // Skip if we've already seen this equation
        const normalizedEq = finalCleaned.replace(/\s+/g, " ").trim().toLowerCase();
        if (!seenEquations.has(normalizedEq)) {
          seenEquations.add(normalizedEq);

          // CRITICAL: Increment equation row counter for fallback equations too
          equationRowCounter++;

          const split = splitEquation(finalCleaned, isPortraitMode);

          if (split) {
            displayRows.push({
              stepNum: equationRowCounter, // Use sequential row number
              type: "equation",
              equation: finalCleaned,
              left: split.left,
              right: split.right,
              isSingleLine: false,
              actionLabel: stepActionLabel,
              isFirstRowOfStep: true,
              bothSidesOp: stepBothSidesOp,
            });
          } else if (finalCleaned.includes("=")) {
            displayRows.push({
              stepNum: equationRowCounter, // Use sequential row number
              type: "equation",
              equation: finalCleaned,
              left: "",
              right: "",
              isSingleLine: true,
              actionLabel: stepActionLabel,
              isFirstRowOfStep: true,
              bothSidesOp: stepBothSidesOp,
            });
          } else {
            // Equation didn't have = - decrement counter
            equationRowCounter--;
          }
        }
      } else {
        // RECOMMENDATION 7.2: Don't skip steps with no equations
        // Instead, show prose content to maintain step number continuity
        const proseContent = step.content || step.explanation || step.summary || "";
        if (proseContent.trim()) {
          // CRITICAL: Prose rows still get sequential numbers
          equationRowCounter++;
          displayRows.push({
            stepNum: equationRowCounter, // Use sequential row number
            type: "prose",
            proseText: proseContent.trim(),
            actionLabel: stepActionLabel,
            isFirstRowOfStep: true,
          });
        }
        // Note: If there's truly no content, we still don't add a row,
        // but this is rare and acceptable - the step had nothing to show
      }
    }
  });

  // Don't render if we couldn't extract any displayable content
  if (displayRows.length === 0) {
    return null;
  }

  return (
    <View
      style={{
        backgroundColor: "#f0f9ff", // Light blue background
        borderWidth: isPortraitMode ? 1.5 : 2,
        borderColor: "#0ea5e9", // Sky blue border
        borderRadius: isPortraitMode ? 16 : 24,
        marginBottom: responsiveSpacing.xl,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <View
        style={{
          backgroundColor: "#0ea5e9",
          paddingVertical: headerPaddingV,
          paddingHorizontal: headerPaddingH,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: responsiveSpacing.sm }}>
          <View
            style={{
              width: headerBadgeSize,
              height: headerBadgeSize,
              borderRadius: headerBadgeSize / 2,
              backgroundColor: "#ffffff",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="list" size={headerIconSize} color="#0ea5e9" />
          </View>
          <Text style={{ fontSize: headerFontSize, fontWeight: "700", color: "#ffffff" }}>
            Solution Steps
          </Text>
        </View>
        <Text
          style={{
            fontSize: subtitleFontSize,
            color: "#e0f2fe",
            marginTop: 2,
            marginLeft: headerBadgeSize + responsiveSpacing.sm,
          }}
        >
          Formal equation progression
        </Text>
      </View>

      {/* Equations Container */}
      <View style={{ padding: containerPadding }}>
        {displayRows.map((row, index) => (
          <View
            key={index}
            style={{
              marginBottom: index < displayRows.length - 1 ? equationGap : 0,
              paddingVertical: equationPaddingV,
            }}
          >
            {/* Action badge - only show on first row of each step */}
            {row.isFirstRowOfStep && row.actionLabel && (
              <View style={{ marginLeft: stepNumberSize + stepNumberMargin, marginBottom: 4 }}>
                <StepActionBadge label={row.actionLabel} />
              </View>
            )}

            {/* Row content with step number and equation/prose */}
            <View
              style={{
                flexDirection: "row",
                alignItems: row.type === "equation" && row.isSingleLine ? "flex-start" : "center",
              }}
            >
              {/* Step number indicator */}
              <View
                style={{
                  width: stepNumberSize,
                  height: stepNumberSize,
                  borderRadius: stepNumberSize / 2,
                  backgroundColor: "#0ea5e9",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: stepNumberMargin,
                  flexShrink: 0,
                  marginTop: row.type === "equation" && row.isSingleLine ? 2 : 0,
                }}
              >
                <Text style={{ fontSize: stepNumberFontSize, fontWeight: "700", color: "#ffffff" }}>
                  {row.stepNum}
                </Text>
              </View>

              {row.type === "prose" ? (
                /* Prose content for steps without equations */
                <View style={{ flex: 1 }}>
                  <MathText size={mathSize} mode="prose">{row.proseText || ""}</MathText>
                </View>
              ) : row.isSingleLine ? (
                /* Single line equation - render the full equation without split */
                <View style={{ flex: 1 }}>
                  <MathText size={mathSize}>{row.equation || ""}</MathText>
                </View>
              ) : (
                /* Split equation with aligned equals sign */
                <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-start" }}>
                  {/* Left side of equation - use flexBasis:0 + minWidth:0 to prevent overflow */}
                  <View style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 0,
                    minWidth: 0,
                    alignItems: "flex-end",
                    paddingRight: equalsPaddingH
                  }}>
                    <MathText size={mathSize}>{row.left || ""}</MathText>
                  </View>

                  {/* Equals sign - fixed position for alignment */}
                  <Text
                    style={{
                      fontSize: equalsFontSize,
                      fontWeight: "700",
                      color: "#0369a1",
                      width: equalsWidth,
                      textAlign: "center",
                      flexShrink: 0,
                      lineHeight: equalsFontSize * 1.5,
                    }}
                  >
                    =
                  </Text>

                  {/* Right side of equation - use flexBasis:0 + minWidth:0 to prevent overflow */}
                  <View style={{
                    flexGrow: 1,
                    flexShrink: 1,
                    flexBasis: 0,
                    minWidth: 0,
                    alignItems: "flex-start",
                    paddingLeft: equalsPaddingH
                  }}>
                    <MathText size={mathSize}>{row.right || ""}</MathText>
                  </View>
                </View>
              )}
            </View>

            {/* Both sides operation row - shows what was done to both sides */}
            {row.isFirstRowOfStep && row.bothSidesOp && (
              <BothSidesOpRow op={row.bothSidesOp} isPortraitMode={isPortraitMode} />
            )}
          </View>
        ))}

        {/* Subtle hint at bottom */}
        <View
          style={{
            marginTop: responsiveSpacing.lg,
            paddingTop: responsiveSpacing.md,
            borderTopWidth: 1,
            borderTopColor: "#bae6fd",
          }}
        >
          <Text
            style={{
              fontSize: hintFontSize,
              color: "#0369a1",
              fontStyle: "italic",
              textAlign: "center",
            }}
          >
            Each equation builds on the previous step
          </Text>
        </View>
      </View>
    </View>
  );
}
