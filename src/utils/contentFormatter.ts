/**
 * Content Formatter Utility - Masking Engine
 *
 * Improvements:
 * 1. Uses a "Masking" strategy to protect Math/Color tags before processing whitespace.
 * 2. Prevents regex collisions (e.g., fixing spacing inside a color tag).
 * 3. Handles "Smart Line Breaks" (keeping paragraphs, merging wrap-lines).
 */

// ============================================================================
// BRANDED TYPE: Single "MathText input contract" (Recommendation 8)
// ============================================================================

/**
 * Branded type representing text that has been fully formatted and is safe
 * to render in MathText without additional processing.
 *
 * This type establishes a contract: any string passed to MathText should
 * be a FormattedMathString, guaranteeing it has been through the
 * canonical formatting pipeline.
 */
export type FormattedMathString = string & { __brand: "FormattedMathString" };

// ============================================================================
// CONTENT-KIND ROUTING: Route content to appropriate formatters
// ============================================================================

import type { ContentKind } from "../types/homework";

/**
 * Detect the content kind of a string to route it to the appropriate formatter.
 * This prevents math-specific transforms from mangling non-math content.
 *
 * @param text - The text to classify
 * @returns ContentKind - "math", "prose", "list", or "code"
 */
export function detectContentKind(text?: string): ContentKind {
  const t = (text ?? "").trim();
  if (!t) return "prose";

  // Multiple choice / ordered list patterns (A. or A) or 1) or - bullet)
  if (/^[A-Da-d]\.\s/m.test(t) || /^\d+\)\s/m.test(t) || /^-\s+/m.test(t)) {
    return "list";
  }

  // Code-ish (triple backticks or ends with semicolon/brace)
  if (t.includes("```") || /;\s*$/.test(t) || /\{\s*$/.test(t)) {
    return "code";
  }

  // Math-ish markers: equations, fractions, color tags, superscripts, subscripts, arrows
  if (
    t.includes("=") ||
    /\{[^}]*\/[^}]*\}/.test(t) ||  // {a/b} fraction syntax
    /\[[a-z]+:/.test(t) ||          // [red:...] color tags
    /\^/.test(t) ||                 // superscripts
    /_\d/.test(t) ||                // subscripts like x_1
    t.includes("→")
  ) {
    return "math";
  }

  return "prose";
}

/**
 * Format content by its kind, routing to the appropriate formatter.
 * This is the primary entry point for content-aware formatting.
 *
 * - math: Full equation pipeline (fractions, labels, line joining, etc.)
 * - list: Preserve list structure, minimal transforms
 * - code: Preserve whitespace exactly
 * - prose: Clean whitespace, no math transforms
 *
 * @param input - The text to format
 * @param kind - The content kind
 * @returns Formatted string
 */
export function formatByKind(input: string, kind: ContentKind): string {
  const text = normalizeLineBreaks(input ?? "").trim();
  if (!text) return "";

  if (kind === "math") {
    // Full equation pipeline (existing formatEquationText)
    return formatEquationText(text);
  }

  if (kind === "list") {
    // Preserve list structure; avoid math transforms that collapse newlines
    // Just normalize excessive newlines
    return text
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  if (kind === "code") {
    // Absolutely minimal: preserve whitespace, just normalize line endings
    return (input ?? "").replace(/\r\n/g, "\n");
  }

  // prose: clean whitespace, no math transforms
  return text
    .replace(/[ \t]+\n/g, "\n")    // Remove trailing spaces on lines
    .replace(/\n{3,}/g, "\n\n")    // Collapse excessive newlines
    .trim();
}

/**
 * CRITICAL: Normalize all line break types to standard \n
 * Handles:
 *   - \r\n (Windows)
 *   - \r (old Mac)
 *   - \u2028 (Unicode line separator)
 *   - \u2029 (Unicode paragraph separator)
 */
export function normalizeLineBreaks(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u2028|\u2029/g, '\n');
}

/**
 * CRITICAL FIX 1: Strip markdown emphasis markers (*x*) before ANY math formatting.
 * This prevents asterisks from being confused with multiplication or leaking into rendered output.
 *
 * Examples:
 *   "*x*" → "x"
 *   "**x**" → "x"
 *   "*[blue:x]*" → "[blue:x]"
 *   "*abc*" → "abc"
 */
export function stripMarkdownEmphasis(text: string): string {
  if (!text) return "";

  let out = text;

  // Handle **bold** patterns first (double asterisks)
  out = out.replace(/\*\*([A-Za-z0-9_]+)\*\*/g, "$1");

  // Handle *[color:content]* patterns (color-tagged variables wrapped in asterisks)
  out = out.replace(/\*(\[(?:red|blue|green|orange|purple|yellow|teal|indigo|pink):[^\]]+\])\*/gi, "$1");

  // Then handle plain *token* patterns (single letters or words)
  // This removes the asterisks from italic markers like *x*, *abc*, *variable*
  out = out.replace(/\*([A-Za-z][A-Za-z0-9_]*)\*/g, "$1");

  return out;
}

/**
 * CRITICAL FIX 1b: Strip dangling asterisks that appear at the end of tokens.
 * These are fragments left over from malformed *x* patterns that got partially processed.
 *
 * Examples:
 *   "x*" → "x" (when followed by whitespace/end/punctuation)
 *   "}*" → "}" (common after fraction closes)
 *   "× x*" → "× x"
 */
export function stripDanglingAsterisks(text: string): string {
  if (!text) return "";

  // Remove trailing asterisk after alphanumeric or closing brace when followed by
  // whitespace, end of string, or common punctuation
  return text.replace(/([A-Za-z0-9_}])\*(?=\s|$|[)\].,;:+\-×÷=])/g, "$1");
}

/**
 * MASTER FUNCTION: Normalize all asterisk usage in text.
 * This should be called at the VERY START of all formatting pipelines.
 *
 * Combines:
 * 1. Strip markdown emphasis (*x*, **x**)
 * 2. Strip dangling asterisks (x*, }*)
 * 3. Remove duplicated variable tokens caused by asterisk bugs (x x)
 *
 * This single function eliminates all asterisk-related corruption before any other processing.
 */
export function normalizeAsterisks(text: string): string {
  if (!text) return "";

  let out = text;

  // Step 1: Strip markdown bold/italic emphasis
  out = out.replace(/\*\*([A-Za-z0-9_]+)\*\*/g, "$1");
  out = out.replace(/\*(\[(?:red|blue|green|orange|purple|yellow|teal|indigo|pink):[^\]]+\])\*/gi, "$1");
  out = out.replace(/\*([A-Za-z][A-Za-z0-9_]*)\*/g, "$1");

  // Step 2: Strip dangling asterisks after tokens
  out = out.replace(/([A-Za-z0-9_}])\*(?=\s|$|[)\].,;:+\-×÷=])/g, "$1");

  // Step 3: Remove duplicated single-letter variables caused by asterisk corruption
  // Pattern: "x x" where the same letter appears twice with just whitespace between
  // This catches corruption like "× x x" from "× *x* x" or similar
  out = out.replace(/\b([A-Za-z])\s+\1\b/g, "$1");

  return out;
}

/**
 * CRITICAL: Disambiguate asterisks that serve two purposes:
 * 1. Italics delimiter: *x*, *variable*
 * 2. Multiplication: {3/4}*8, 2*x*, etc.
 *
 * Strategy: Mask italic tokens first, convert remaining multiplication asterisks to ×, then unmask.
 * This prevents breaking italic markers when fixing multiplication.
 */

type MaskMap = { text: string; map: Record<string, string> };

/**
 * Mask italic tokens (*letter...*) so they aren't confused with multiplication asterisks.
 * Only treats *...* as italics when content starts with a letter.
 * Examples masked: *x*, *abc*, *x2*, *PE_spring*
 *
 * CRITICAL: Each placeholder MUST be unique to prevent map overwrites and token leakage.
 * The placeholder format (IMASK#IMASK) starts with a letter so the multiplication regex
 * can properly "see" it as a valid left operand context.
 */
function maskItalicsTokens(input: string): MaskMap {
  const map: Record<string, string> = {};
  let i = 0;

  // Match *content* where content starts with a letter and may contain letters, digits, underscores
  // This covers variables like *x*, *PE_spring*, *v_0*, etc.
  const text = input.replace(/\*([a-zA-Z][a-zA-Z0-9_]*)\*/g, (match) => {
    // MUST be unique per match; MUST start with a letter so the existing
    // times-regex can properly recognize it as an operand context
    const key = `IMASK${i++}IMASK`;
    map[key] = match; // Keep original including asterisks
    return key;
  });

  return { text, map };
}

/**
 * Restore masked tokens back to their original form.
 * Replaces in longest-key-first order to handle any nested scenarios safely.
 */
function unmaskTokens(input: string, map: Record<string, string>): string {
  let out = input;

  // Replace in stable order (longest-first is a safe habit if key schemes ever change)
  const keys = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    out = out.split(key).join(map[key]);
  }

  return out;
}

// ============================================================================
// FINALIZATION: Prevent internal formatting artifacts from leaking to output
// ============================================================================

/**
 * Known internal placeholder/marker patterns that should NEVER appear in final output.
 * These are used during formatting pipeline and must be stripped before rendering.
 */
const FORMAT_LEAK_REGEXES: RegExp[] = [
  /\bIMASK\d+IMASK\b/g,           // Italic masking tokens
  /\bMASK\d+\b/g,                  // Generic mask tokens
  /\b_MASK\d+_?\b/g,               // Underscore-wrapped mask tokens
  /\bPLACEHOLDER[_\d]+\b/g,        // Placeholder tokens
  /XXIMAGEPROTECTED\d*XX/g,        // Image protection tokens
  /〔PROTECTED\d+〕/g,              // Unicode-bracket protected tokens
  /\bLIST_BREAK\b/g,               // List break markers
  /⟪STEP⟫/g,                       // Step boundary markers
  /<<ITALIC_\d+>>/g,               // Legacy italic tokens (if any remain)
  /__FILE_URL_\d+__/g,             // File URL placeholders
];

/**
 * Strip all known internal formatting artifacts from text.
 * This is the defensive cleanup that catches any tokens that escaped unmask steps.
 */
function stripInternalArtifacts(text: string): string {
  let out = text;

  for (const rx of FORMAT_LEAK_REGEXES) {
    // Reset lastIndex for global regexes before use
    rx.lastIndex = 0;
    out = out.replace(rx, "");
  }

  // Clean up any whitespace damage caused by stripping tokens
  out = out
    .replace(/[ \t]+\n/g, "\n")      // Trailing whitespace before newlines
    .replace(/\n{3,}/g, "\n\n")      // Excessive newlines
    .replace(/[ \t]{2,}/g, " ")      // Multiple spaces
    .trim();

  return out;
}

/**
 * Development-only assertion to detect formatting leakage.
 * In DEV mode: throws an error to help catch issues early during development.
 * In PROD mode: silently continues (defensive - don't crash the app).
 *
 * CRITICAL: This is part of the "format once, render only" contract enforcement.
 * If this throws, it means internal markers leaked through the formatting pipeline.
 */
function assertNoInternalArtifacts(text: string, context: string): void {
  // Only run in development - use typeof check for React Native compatibility
  const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : false;
  if (!isDev) return;

  for (const rx of FORMAT_LEAK_REGEXES) {
    rx.lastIndex = 0;
    if (rx.test(text)) {
      rx.lastIndex = 0;
      // Find the actual leaked token for better error message
      const match = text.match(rx);
      const leakedToken = match ? match[0] : rx.source;

      // CRITICAL: Throw in DEV to enforce the formatting contract
      // This ensures developers catch leakage issues immediately
      throw new Error(
        `[contentFormatter] FORMATTING CONTRACT VIOLATION in ${context}: ` +
        `Internal marker leaked to output: "${leakedToken}". ` +
        `This indicates the formatting pipeline failed to clean up internal tokens. ` +
        `Check the formatting functions called before ${context}.`
      );
    }
    rx.lastIndex = 0;
  }
}

/**
 * CRITICAL: Final cleanup step for ALL outward-facing formatter functions.
 * This ensures no internal masking tokens ever reach the rendered output.
 *
 * Call this at the end of formatAIContent, formatEquationText, formatTitle, etc.
 */
function finalizeFormattedText(text: string, context: string): string {
  if (!text) return "";

  let out = text;

  // First, run the existing cleanupMaskTokens if any tokens slipped through
  out = cleanupMaskTokens(out);

  // Then strip any remaining internal artifacts
  out = stripInternalArtifacts(out);

  // Assert in dev mode to catch issues
  assertNoInternalArtifacts(out, context);

  return out;
}

/**
 * Convert multiplication asterisks to × symbol.
 * Works for patterns like:
 *   {3/4}*8   → {3/4} × 8
 *   {3/4}*(x) → {3/4} × (x)
 *   2*IMASK0IMASK → 2 × *x* (after unmasking)
 *
 * Avoids bullets ("* item") since there's no left operand.
 * NOTE: No lookbehind for Hermes compatibility.
 */
function convertMultiplicationAsterisksToTimes(input: string): string {
  // Match: (digit/letter/}/)/]) followed by optional whitespace, *, optional whitespace,
  // then lookahead for (digit/letter/{/(/[/-)
  return input.replace(
    /([0-9a-zA-Z\}\)\]])\s*\*\s*(?=[0-9a-zA-Z\{\(\[\-])/g,
    '$1 × '
  );
}

/**
 * Main function to disambiguate asterisks.
 * Call this EARLY in formatting pipeline before any italic parsing or fraction masking.
 *
 * Results:
 *   {3/4}*8     → {3/4} × 8
 *   {3/2}*x*    → {3/2} × *x*
 *   2*x* + 1    → 2 × *x* + 1
 *   *x* + 5     → *x* + 5 (unchanged - no multiplication context)
 */
export function disambiguateAsterisks(input: string): string {
  const masked = maskItalicsTokens(input);
  const fixed = convertMultiplicationAsterisksToTimes(masked.text);
  return unmaskTokens(fixed, masked.map);
}

/**
 * CRITICAL: Stack-based removal of newlines inside ANY balanced delimiters
 * This handles nested delimiters safely without regex limitations.
 * Now handles: parentheses (), braces {}, and brackets []
 *
 * Examples:
 *   "(x +\n6)" → "(x + 6)"
 *   "((a +\nb) +\nc)" → "((a + b) + c)"
 *   "{num/\nden}" → "{num/den}"
 *   "[red:\ntext]" → "[red: text]"
 *   "text\n(x + 6)\nmore" → "text\n(x + 6)\nmore" (newlines outside delimiters preserved)
 */
export function removeNewlinesInsideDelimiters(text: string): string {
  const result: string[] = [];
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Track parentheses
    if (char === '(') {
      parenDepth++;
      result.push(char);
    } else if (char === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      result.push(char);
    }
    // Track braces
    else if (char === '{') {
      braceDepth++;
      result.push(char);
    } else if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      result.push(char);
    }
    // Track brackets
    else if (char === '[') {
      bracketDepth++;
      result.push(char);
    } else if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      result.push(char);
    }
    // Handle newlines inside any delimiter
    else if (char === '\n' && (parenDepth + braceDepth + bracketDepth) > 0) {
      // Inside delimiters - replace newline with space
      // Also collapse any whitespace around the newline
      // Look ahead and skip any following whitespace
      let j = i + 1;
      while (j < text.length && (text[j] === ' ' || text[j] === '\t')) {
        j++;
      }
      // Look back and see if we already have a space
      const lastChar = result.length > 0 ? result[result.length - 1] : '';
      if (lastChar !== ' ' && lastChar !== '\t') {
        result.push(' ');
      }
      i = j - 1; // Skip the whitespace (loop will increment by 1)
    } else {
      result.push(char);
    }
  }

  return result.join('');
}

/**
 * Check if a string has unbalanced delimiters
 * Returns true if there are more opening delimiters than closing ones
 */
function hasUnbalancedDelims(s: string): boolean {
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (const ch of s) {
    if (ch === '(') parenDepth++;
    else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
    if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
  }

  return parenDepth !== 0 || braceDepth !== 0 || bracketDepth !== 0;
}

/**
 * CRITICAL: Join broken equation lines
 * For equation blocks, merge lines when the current line appears incomplete.
 *
 * "Incomplete" heuristics:
 *   - Ends with an operator (+, -, *, /, =)
 *   - Ends with an opening delimiter
 *   - Has unbalanced delimiters (more opening than closing)
 *   - Next line starts with a closing delimiter or operator
 *
 * IMPORTANT: Do NOT join lines when the next line is a label (e.g., "Right-hand side:", "Left-hand side:")
 */
function isIncompleteEquationLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;

  // Has unbalanced delimiters
  if (hasUnbalancedDelims(trimmed)) return true;

  // Ends with an operator
  if (/[+\-*/=]$/.test(trimmed)) return true;

  // Ends with an opening delimiter
  if (/[([{]$/.test(trimmed)) return true;

  // Ends with a comma (likely incomplete list)
  if (/,$/.test(trimmed)) return true;

  return false;
}

/**
 * Check if a line starts with a closing delimiter or operator
 * indicating it should be joined to the previous line
 */
function startsWithContinuation(line: string): boolean {
  const trimmed = line.trim();
  // Starts with closing delimiter
  if (/^[)\]}]/.test(trimmed)) return true;
  // Starts with operator (but not if it's a negative number)
  if (/^[+*/=]/.test(trimmed)) return true;
  // Starts with minus followed by non-digit (operator, not negative number)
  if (/^-[^0-9]/.test(trimmed)) return true;
  return false;
}

/**
 * Check if a line looks like the start of a NEW equation
 * (not a continuation of the previous line)
 * Examples: "6x - 15 = ...", "2x + 3 = ...", "Area = ..."
 */
function startsNewEquation(line: string): boolean {
  const trimmed = line.trim();
  // Pattern: starts with a number or variable, followed by content that includes =
  // This indicates a new equation like "6x - 15 + 4 = 2x + 14"
  // Must have = sign to be considered an equation (not just a continuation)
  if (/^[0-9a-zA-Z*_]/.test(trimmed) && trimmed.includes('=')) {
    // Make sure the = is not at the very start (which would be a continuation)
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex > 2) { // At least "x =" or "2x=" worth of content before =
      return true;
    }
  }
  return false;
}

/**
 * Check if a line is a label that should start on its own line
 * Examples: "Left-hand side:", "Right-hand side:", "Step 1:", etc.
 *
 * CRITICAL: This function is used to prevent joinBrokenEquationLines from
 * joining lines across label boundaries. Labels are structural markers that
 * must remain isolated.
 */
function isLabelLine(line: string): boolean {
  const trimmed = line.trim();
  // Check for common label patterns that should start on their own line
  // Pattern: word(s) followed by colon at the end, OR common labels
  // EXPANDED to catch more variants
  if (/^(Left-hand side|Right-hand side|Left side|Right side|Left Side|Right Side|LHS|RHS|Step \d+|Part [a-zA-Z]|Case \d+|Solution|Answer|Result|Given|Find|Proof|Example|Original equation|Simplified|Therefore|Hence|Thus|Equation after simplifying):/i.test(trimmed)) {
    return true;
  }
  return false;
}

/**
 * Check if a line is empty or just whitespace - used as a hard boundary
 */
function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

export function joinBrokenEquationLines(text: string): string {
  // CRITICAL: First, split by double newlines to preserve paragraph boundaries
  // Then process each paragraph separately
  const paragraphs = text.split(/\n\s*\n/);
  const processedParagraphs: string[] = [];

  for (const paragraph of paragraphs) {
    const rawLines = paragraph.split('\n').map(l => l.trim()).filter(Boolean);
    const result: string[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      let currentLine = rawLines[i];

      // CRITICAL: If current line is a label, add it as-is and continue
      // Labels are structural boundaries and should NEVER be joined
      if (isLabelLine(currentLine)) {
        result.push(currentLine);
        continue;
      }

      // Keep joining with next line while:
      // 1. Current line is incomplete, OR
      // 2. Next line starts with a continuation character
      // BUT stop if the next line is a label (should start on its own line)
      // AND stop if the next line starts a new equation (not a continuation)
      while (i + 1 < rawLines.length) {
        const nextLine = rawLines[i + 1];

        // CRITICAL: NEVER join if next line is a label
        // This prevents "equation Right Side:" from being joined
        if (isLabelLine(nextLine)) {
          break;
        }

        // CRITICAL: Don't join if next line starts a new equation
        // This preserves line breaks between separate equations like:
        // "3(2x - 5) + 4 = 2(x + 7) - (x - 3)"
        // "6x - 15 + 4 = 2x + 14 - x + 3"
        if (startsNewEquation(nextLine)) {
          break;
        }

        const shouldJoin = isIncompleteEquationLine(currentLine) ||
                           startsWithContinuation(nextLine);

        if (!shouldJoin) break;

        currentLine = `${currentLine} ${nextLine}`.replace(/\s+/g, ' ').trim();
        i++;
      }

      result.push(currentLine);
    }

    processedParagraphs.push(result.join('\n'));
  }

  return processedParagraphs.join('\n\n');
}

// Legacy wrapper for backward compatibility
function removeNewlinesInsideParens(text: string): string {
  return removeNewlinesInsideDelimiters(text);
}

/**
 * CRITICAL: Force label isolation even if AI forgets newlines
 * This rewrites labels wherever they occur - no boundary detection needed.
 *
 * Also normalizes label variants to canonical forms:
 * - "Left side:", "Left-hand-side:" → "Left Side:"
 * - "Right side:", "Right-hand-side:" → "Right Side:"
 *
 * Examples:
 *   "... + 5 Right-hand side:" → "... + 5\n\nRight Side:\n"
 *   "equation Left-hand side:" → "equation\n\nLeft Side:\n"
 */
export function isolateLabels(text: string): string {
  let result = text;

  // STEP 1: Normalize label variants to canonical forms
  // Left variants → "Left Side:"
  result = result.replace(
    /\b(Left-hand-side|Left-hand side|Left side|left side|left-hand side|left-hand-side):/gi,
    'Left Side:'
  );
  // Right variants → "Right Side:"
  result = result.replace(
    /\b(Right-hand-side|Right-hand side|Right side|right side|right-hand side|right-hand-side):/gi,
    'Right Side:'
  );

  // STEP 2: Isolate label patterns - ensure they're on their own lines
  // This now handles the normalized forms plus other common labels
  result = result.replace(
    /\s*\b(Left Side:|Right Side:|LHS:|RHS:|Original equation:|Simplified:|Therefore:|Hence:|Thus:|Equation after simplifying[^:]*:)\s*/gi,
    '\n\n$1\n'
  );

  // Clean up any resulting triple+ newlines
  result = result.replace(/\n{3,}/g, '\n\n');
  // Clean up leading newlines
  result = result.replace(/^\n+/, '');
  return result;
}

/**
 * CRITICAL: Single centralized function for normalizing equation blocks BEFORE extraction.
 *
 * This function consolidates all equation-block normalization logic in one place,
 * preventing the "line break chaos" that occurs when multiple systems compete:
 * - contentFormatter's newline pipeline
 * - FormalStepsBox's split/trim/filter
 * - MathText's multiline handling
 *
 * Use this at the START of any equation extraction logic (extractAllEquations, extractEquation).
 * It preserves structural boundaries (labels, paragraph breaks) while fixing:
 * - Broken lines inside delimiters: "(x +\n6)" → "(x + 6)"
 * - Incomplete equation wraps that should be joined
 * - Label isolation: "equation Right Side:" → "equation\n\nRight Side:\n"
 *
 * IMPORTANT: After calling this, split on "\n" but do NOT aggressively filter empty lines
 * until the point of use. Empty lines may represent intentional boundaries.
 */
export function normalizeEquationBlockForExtraction(input: string): string {
  if (!input) return "";

  let s = normalizeLineBreaks(input);

  // Preserve structural labels as hard boundaries (Left Side / Right Side / etc.)
  s = isolateLabels(s);

  // Remove accidental wraps inside (), {}, [] so math tokens don't fragment
  s = removeNewlinesInsideDelimiters(s);

  // Join only truly-broken equation wraps, but don't cross labels/new equations
  s = joinBrokenEquationLines(s);

  // Finalize to ensure no internal tokens leak through
  return finalizeFormattedText(s.trim(), "normalizeEquationBlockForExtraction");
}

/**
 * CRITICAL: Fix fraction-adjacent numbers into explicit multiplication
 * This catches {3/4}8, {1/2}(...), {3/4}  8, etc.
 * BUT does not touch {3/4}x (variable coefficient is allowed)
 *
 * Examples:
 *   "{3/4}8" → "{3/4} × 8"
 *   "{1/2}(x+1)" → "{1/2} × (x+1)"
 *   "{3/4}x" → "{3/4}x" (unchanged - variable coefficient)
 */
function normalizeFractionMultiplication(text: string): string {
  let result = text;
  // Pattern: fraction followed by optional whitespace then digit
  // {num/den} followed by digit → {num/den} × digit
  result = result.replace(/\{(\d+\s*\/\s*\d+)\}\s*(\d)/g, '{$1} × $2');
  // Pattern: fraction followed by optional whitespace then opening paren
  // {num/den} followed by ( → {num/den} × (
  result = result.replace(/\{(\d+\s*\/\s*\d+)\}\s*\(/g, '{$1} × (');
  // Pattern: fraction followed by asterisk (convert to ×)
  // {num/den}*something → {num/den} × something
  result = result.replace(/\{(\d+\s*\/\s*\d+)\}\s*\*\s*/g, '{$1} × ');
  return result;
}

/**
 * CRITICAL: Normalize parenthetical fractions to brace syntax
 * AI often emits (x/2) or (3x/2) instead of curly brace fractions.
 *
 * Conservative approach: Only convert patterns that are CLEARLY fractions:
 * - Simple numeric: (3/4) becomes curly brace fraction
 * - Variable terms: (3x/4), (x/2) become curly brace fractions
 *
 * Does NOT convert:
 * - Complex expressions like (a + b/c)
 * - Function notation like (f(x)/g(x))
 * - Array indices or other uses of parentheses with slashes
 */
export function normalizeFractionForms(text: string): string {
  let result = text;

  // CRITICAL: First, protect file:// URLs from any modifications
  // Image URLs like file:///var/mobile/Containers/Data/... must NOT have slashes converted
  const fileUrlPlaceholders: Map<string, string> = new Map();
  let fileUrlCounter = 0;
  result = result.replace(/file:\/\/\/[^\s\)]+/g, (match) => {
    const placeholder = `__FILE_URL_${fileUrlCounter++}__`;
    fileUrlPlaceholders.set(placeholder, match);
    return placeholder;
  });

  // CRITICAL: Protect word/word patterns like "opposite/adjacent" from being treated as fractions
  // These are ratio descriptions, not mathematical fractions to be rendered vertically
  // Pattern: word/word where both are alphabetic (not numbers)
  // We'll convert the slash to a special character that won't trigger fraction parsing
  // Use "∕" (U+2215 DIVISION SLASH) which looks like / but won't be parsed as a fraction
  result = result.replace(/\b([a-zA-Z]+)\/([a-zA-Z]+)\b/g, '$1∕$2');

  // Pattern 1: (number/number) - simple numeric fractions
  // Examples: (3/4), (1/2), (12/7)
  result = result.replace(/\((\d+)\s*\/\s*(\d+)\)/g, '{$1/$2}');

  // Pattern 2: (expression/number) where expression is a simple term
  // Examples: (3x/4), (x/2), (-3x/2)
  // Must not contain: +, -, spaces (indicating a complex expression)
  result = result.replace(
    /\((-?\d*[a-zA-Z]+)\s*\/\s*(\d+)\)/g,
    '{$1/$2}'
  );

  // Pattern 3: (-number/number) - negative fractions
  // Examples: (-3/4), (-1/2)
  result = result.replace(/\((-\d+)\s*\/\s*(\d+)\)/g, '{$1/$2}');

  // CRITICAL: Restore file:// URLs that were protected earlier
  fileUrlPlaceholders.forEach((original, placeholder) => {
    result = result.split(placeholder).join(original);
  });

  return result;
}

/**
 * Normalize fraction tokens so MathText can recognize them
 * Handles various edge cases in fraction syntax from AI output.
 *
 * Examples:
 *   "{ 3 / 4 }" → "{3/4}"
 *   "{3 /4}" → "{3/4}"
 *   "{ 3/4}" → "{3/4}"
 *   "{3/ 4 }" → "{3/4}"
 *   "{-3/4}" → "{-3/4}" (preserves negative)
 */
function normalizeFractions(text: string): string {
  let result = text;

  // Pattern: { optional-whitespace content / content optional-whitespace }
  // Normalize whitespace inside fraction braces
  result = result.replace(/\{\s*([^}\/]+?)\s*\/\s*([^}]+?)\s*\}/g, (match, num, den) => {
    // Trim both parts and reconstruct
    const numerator = num.trim();
    const denominator = den.trim();
    return `{${numerator}/${denominator}}`;
  });

  return result;
}

/**
 * CRITICAL: Normalize fractions that are immediately followed by digits/letters/parens
 * Without a space or operator, these can cause parsing issues.
 *
 * Examples:
 *   "{3/4}8" → "{3/4} × 8"  (fraction times number)
 *   "{3/4}x" → "{3/4}x"     (coefficient notation - keep as is for variables)
 *   "{3/4}(x+1)" → "{3/4}(x + 1)" (fraction times parenthetical)
 */
function normalizeAdjacentFractions(text: string): string {
  // Pattern: fraction immediately followed by a digit - insert multiplication
  // {num/den}digit → {num/den} × digit
  let result = text.replace(/\}(\d)/g, '} × $1');

  // Pattern: fraction immediately followed by opening paren - insert multiplication
  // {num/den}( → {num/den} × (
  result = result.replace(/\}\(/g, '} × (');

  return result;
}

/**
 * Dedicated title formatter - removes all line breaks for single-line display
 * Step titles should NEVER have line breaks.
 */
export function formatTitle(title: string): string {
  if (!title) return "";
  const result = normalizeLineBreaks(title)
    .replace(/\s+/g, ' ')
    .trim();
  return finalizeFormattedText(result, "formatTitle");
}

/**
 * Dedicated equation formatter for FormalStepsBox
 * This is a MINIMAL formatter that only cleans equations without aggressive text processing.
 *
 * Unlike formatAIContent (which handles full paragraphs with line break management),
 * this function preserves mathematical structure while normalizing syntax.
 */
export function formatEquationText(text: string): string {
  if (!text) return "";

  let result = text;

  // STEP 0: CRITICAL - Normalize asterisks FIRST before any other processing
  // This strips markdown emphasis (*x*, **x**), dangling asterisks (x*), and
  // removes duplicated variables (x x) caused by asterisk corruption
  result = normalizeAsterisks(result);

  // Step 1: Normalize all line break types (Windows, old Mac, Unicode)
  result = normalizeLineBreaks(result);

  // Step 1.5: CRITICAL - Disambiguate any remaining asterisks
  // The AI uses * for both multiplication ({3/4}*8) and italics (*x*).
  // This masks italic tokens, converts multiplication * to ×, then unmasks.
  result = disambiguateAsterisks(result);

  // Step 1.6: CRITICAL - Normalize parenthetical fractions to brace syntax
  // AI often emits (3x/2) instead of {3x/2}. Convert early before other processing.
  result = normalizeFractionForms(result);

  // Step 2: CRITICAL - Isolate labels (Left-hand side:, Right-hand side:, etc.)
  // This must happen early to ensure labels get proper line breaks
  result = isolateLabels(result);

  // Step 3: Normalize fraction syntax FIRST (before removing newlines inside braces)
  result = normalizeFractions(result);

  // Step 4: CRITICAL - Fix fraction-adjacent numbers ({3/4}8 → {3/4} × 8)
  result = normalizeFractionMultiplication(result);

  // Step 5: Remove newlines inside ANY delimiters (stack-based, handles nesting)
  result = removeNewlinesInsideDelimiters(result);

  // Step 6: Join broken equation lines (merge incomplete lines)
  result = joinBrokenEquationLines(result);

  // Step 7: Normalize adjacent fractions (e.g., {3/4}8 → {3/4} × 8) - second pass
  result = normalizeAdjacentFractions(result);

  // Step 8: Fix common AI output issues specific to equations
  // NOTE: Color tags [red:...] and italic markers *...* are PRESERVED for MathText rendering

  // Remove arrows that might appear in equation context
  result = result.replace(/\s*→\s*/g, " ");

  // Fix stray underscores before operators or parentheses
  result = result.replace(/(\d+)_+\)/g, "$1)");
  result = result.replace(/(\d+)_+([+\-*/])/g, "$1 $2");
  result = result.replace(/(\d+)_+\s/g, "$1 ");

  // Collapse multiple spaces
  result = result.replace(/\s{2,}/g, " ");

  // Trim
  result = result.trim();

  // CRITICAL: Finalize to strip any leaked internal tokens
  return finalizeFormattedText(result, "formatEquationText");
}

/**
 * CRITICAL: Force line breaks between list items (A-D, 1-5, etc.)
 * This is the NUCLEAR OPTION for the persistent A-D line break problem.
 *
 * Strategy: Detect list patterns and programmatically insert line breaks.
 * This works regardless of what the AI generates.
 *
 * IMPORTANT: We use a special marker LIST_BREAK that will be protected
 * from aggressive line break removal later in the pipeline.
 */
function forceListItemLineBreaks(content: string): string {
  let result = content;

  // ULTRA AGGRESSIVE APPROACH: Match ANY occurrence of " A. " or " B. " or " C. " or " D. "
  // that appears AFTER some content and insert line break BEFORE it
  // This is simpler and more reliable than trying to match complex patterns

  // CRITICAL FIX: Remove underscores from list markers FIRST
  // AI sometimes generates "B_." or "D_." which breaks formatting
  // Pattern: A-D followed by underscore and then period
  result = result.replace(/([A-D])_+\./g, '$1.');
  result = result.replace(/([A-D])_+\)/g, '$1)');

  // IMPORTANT: Process content to ensure consistent spacing around list markers
  // Sometimes AI generates "B.Metabolic" or "B. Metabolic" inconsistently
  // Normalize to always have single space after the period/paren
  result = result.replace(/([A-D])\.([A-Z])/g, '$1. $2');
  result = result.replace(/([A-D])\)([A-Z])/g, '$1) $2');

  // CRITICAL FIX: Handle list items with PARENTHESES format like "(a)" "(b)" "(c)"
  // These often appear in problem statements without preceding spaces: "text. (a) Write"
  // Pattern 1: Match (a), (b), (c), (d) after punctuation or space
  result = result.replace(
    /(.{20,})([\.!\?:;,])\s*\(([a-dA-D])\)\s+/g,
    '$1$2LIST_BREAK($3) '
  );

  // Pattern 2: Match (a), (b), (c), (d) after whitespace
  result = result.replace(
    /(.{20,})\s+\(([a-dA-D])\)\s+/g,
    '$1LIST_BREAK($2) '
  );

  // Step 1: Match pattern " X. " where X is A-D and preceded by at least 20 characters
  // This ensures we're in the middle of content, not at the start
  // Pattern: (at least 20 chars) + space + letter + period + space
  result = result.replace(
    /(.{20,})\s+([A-D])\.\s+/g,
    '$1LIST_BREAK$2. '
  );

  // Step 2: Also handle parenthesis format " X) " (without opening paren)
  result = result.replace(
    /(.{20,})\s+([A-D])\)\s+/g,
    '$1LIST_BREAK$2) '
  );

  // Step 3: Numbered lists with period " 2. " etc (not " 1. " at start)
  result = result.replace(
    /(.{20,})\s+([2-9]|[1-9][0-9])\.\s+/g,
    '$1LIST_BREAK$2. '
  );

  // Step 4: Numbered lists with parenthesis " 2) " etc
  result = result.replace(
    /(.{20,})\s+([2-9]|[1-9][0-9])\)\s+/g,
    '$1LIST_BREAK$2) '
  );

  return result;
}

/**
 * CRITICAL: Remove any leaked MASK tokens that made it through formatting
 * This is a safety net for content that was improperly formatted
 */
function cleanupMaskTokens(content: string): string {
  // Remove standalone MASK tokens that weren't properly replaced
  // Pattern: MASK followed by digits, potentially with underscores
  // IMPORTANT: Preserve surrounding spaces to avoid collapsing words
  let cleaned = content.replace(/\bMASK\d+\b/g, ' ');
  cleaned = cleaned.replace(/\b_MASK\d+_?\b/g, ' ');
  // Also remove PLACEHOLDER tokens
  cleaned = cleaned.replace(/PLACEHOLDER[_\d]+/g, ' ');
  // Also remove the unicode-bracket protected tokens
  cleaned = cleaned.replace(/〔PROTECTED\d+〕/g, ' ');
  return cleaned;
}

/**
 * Fix common formatting issues in AI-generated content
 */
function fixRawNotation(content: string): string {
  let result = content;

  // Fix fractions that should use {num/den} syntax
  // Convert "½" to "{1/2}", etc.
  const fractionMap: Record<string, string> = {
    '½': '{1/2}',
    '⅓': '{1/3}',
    '⅔': '{2/3}',
    '¼': '{{1/4}}',
    '¾': '{3/4}',
    '⅕': '{1/5}',
    '⅖': '{2/5}',
    '⅗': '{3/5}',
    '⅘': '{4/5}',
    '⅙': '{1/6}',
    '⅚': '{5/6}',
    '⅛': '{1/8}',
    '⅜': '{3/8}',
    '⅝': '{5/8}',
    '⅞': '{7/8}',
  };

  Object.entries(fractionMap).forEach(([unicode, syntax]) => {
    result = result.replace(new RegExp(unicode, 'g'), syntax);
  });

  // Convert unicode superscripts to caret notation
  // Map: ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ → ^0^ ^1^ ^2^ etc.
  const superscriptMap: Record<string, string> = {
    '⁰': '^0^',
    '¹': '^1^',
    '²': '^2^',
    '³': '^3^',
    '⁴': '^4^',
    '⁵': '^5^',
    '⁶': '^6^',
    '⁷': '^7^',
    '⁸': '^8^',
    '⁹': '^9^',
    '⁺': '^+^',
    '⁻': '^-^',
  };

  Object.entries(superscriptMap).forEach(([unicode, syntax]) => {
    result = result.replace(new RegExp(unicode, 'g'), syntax);
  });

  // Convert unicode subscripts to underscore notation
  // Map: ₀₁₂₃₄₅₆₇₈₉ → _0_ _1_ _2_ etc.
  const subscriptMap: Record<string, string> = {
    '₀': '_0_',
    '₁': '_1_',
    '₂': '_2_',
    '₃': '_3_',
    '₄': '_4_',
    '₅': '_5_',
    '₆': '_6_',
    '₇': '_7_',
    '₈': '_8_',
    '₉': '_9_',
  };

  Object.entries(subscriptMap).forEach(([unicode, syntax]) => {
    result = result.replace(new RegExp(unicode, 'g'), syntax);
  });

  // Convert parenthetical fractions: (num)/(den) → {num/den}
  // Pattern: (digits or simple expressions) / (digits or simple expressions)
  result = result.replace(/\((\d+(?:\.\d+)?)\)\s*\/\s*\((\d+(?:\.\d+)?)\)/g, '{$1/$2}');

  // Convert simple inline fractions in common contexts
  // Pattern: space or start, then digit(s)/digit(s), then space or operator
  // Examples: "1/2 k x²" → "{1/2} k x²", "PE = 1/2 m" → "PE = {1/2} m"
  // Must be careful not to match dates (1/2/2024) or other ratios
  result = result.replace(/(\s|^|=|\()(\d{1,2})\/(\d{1,2})(\s|$|[a-zA-Z]|\*|\)|,|\.)/g, '$1{$2/$3}$4');

  return result;
}

/**
 * Auto-close unclosed subscripts and superscripts that AI commonly outputs
 * This handles both standalone and those inside color tags
 */
function fixUnclosedNotation(content: string): string {
  let result = content;

  // CRITICAL: Convert parenthetical superscripts to standard notation
  // Pattern: ^(-1) or ^(2) → ^-1^ or ^2^
  // This handles inverse function notation like tan^(-1), sin^(-1), cos^(-1)
  result = result.replace(/\^\((-?\d+)\)/g, '^$1^');

  // Fix superscripts: variable/number/paren followed by ^ and digits/symbols but no closing ^
  // Pattern: letter OR number OR closing paren followed by ^, then 1-3 chars, not already closed
  // Examples: "x^2" → "x^2^", "4.08^2" → "4.08^2^", "(0.06)^2" → "(0.06)^2^"
  result = result.replace(/([a-zA-Z\d.)\]]+)\^(\d{1,2}|[+\-]|\w{1,3})(?!\^)(\s|,|\.|\]|\)|=|$|:|\/)/g, '$1^$2^$3');

  // Fix subscripts: variable followed by _ and word, not already closed
  // Pattern: letter followed by _, then word characters, not already closed
  // More precise: only close if followed by space, punctuation, or end
  result = result.replace(/([a-zA-Z])_([a-zA-Z]+\d*|initial|final|spring|max|min|net|\d{1,2})(?!_)(\s|,|\.|\]|\)|=|$|:)/g, '$1_$2_$3');

  return result;
}

/**
 * CRITICAL: Fix redundant answer display patterns
 * AI sometimes outputs: "y = -3/8 x + 4: [red:y = -3/8 x + 4]"
 * Or even worse after line break issues: "for : y = 8x - 2 → [red:y = 8x - 2]"
 * Or: "pi × (4 cm)² = 16pi cm² → [red:16pi cm²]" (answer appears before AND inside red tag)
 * Should be: "pi × (4 cm)² → [red:16pi cm²]"
 * This function removes the redundancy
 */
function fixRedundantAnswers(content: string): string {
  let result = content;

  // EMERGENCY FIX: Remove orphaned "for :" fragments that appear before equations
  // These are leftovers from "...to solve for *y*:" that got split
  result = result.replace(/\bfor\s*:\s*([*a-zA-Z])/g, '$1');

  // CRITICAL PATTERN: "expression = value → [red:value]" - the value after = matches value in red
  // This is the most common redundancy pattern where the calculated result appears twice
  // Example: "pi × (4 cm)² = 16pi cm² → [red:16pi cm²]" should become "pi × (4 cm)² → [red:16pi cm²]"
  // We need to keep the expression before =, remove the "= value" part, and keep "→ [red:value]"
  const equationRedundancyPattern = /([^=\n]+)=\s*([^→\n]+?)\s*→\s*\[red:([^\]]+)\]/g;
  result = result.replace(equationRedundancyPattern, (match, expression, valueBefore, redContent) => {
    // Clean both for comparison - remove spaces, asterisks, and normalize
    const beforeClean = valueBefore.trim().replace(/[\s*{}]/g, '').toLowerCase();
    const redClean = redContent.trim().replace(/[\s*{}]/g, '').toLowerCase();

    // Check if the value before the arrow matches what's in the red tag
    if (beforeClean === redClean ||
        beforeClean.includes(redClean) ||
        redClean.includes(beforeClean) ||
        // Also check if they're the same after removing units notation differences
        beforeClean.replace(/cm[²³]?|pi/g, '') === redClean.replace(/cm[²³]?|pi/g, '')) {
      // Remove the duplicate "= value" part, keep expression and red-tagged result
      return `${expression.trim()} → [red:${redContent}]`;
    }
    return match;
  });

  // Pattern 1: "equation → [red:same equation]" - This is REDUNDANT even with arrow
  // Match the equation before → and compare with what's inside [red:]
  const arrowRedPattern = /([*a-zA-Z0-9\s=+\-×÷\{\}/.()]+)\s*→\s*\[red:([^\]]+)\]/g;
  result = result.replace(arrowRedPattern, (match, before, inside) => {
    // Clean both for comparison
    const beforeClean = before.trim().replace(/[\s*{}]/g, '');
    const insideClean = inside.trim().replace(/[\s*{}]/g, '');

    // If the equation appears both before arrow AND inside red, remove the duplicate before arrow
    if (beforeClean === insideClean || insideClean.includes(beforeClean) || beforeClean.includes(insideClean)) {
      return `→ [red:${inside}]`;
    }
    return match;
  });

  // Pattern 2: "text: [red:text]" where text before colon matches text in red
  // Only apply if content before colon is very similar to content inside [red:]
  const colonRedPattern = /([^:\n→]{10,}):\s*\[red:([^\]]+)\]/g;
  result = result.replace(colonRedPattern, (match, before, inside) => {
    // Remove spaces, asterisks, braces from both to compare core content
    const beforeClean = before.trim().replace(/[\s*{}]/g, '');
    const insideClean = inside.trim().replace(/[\s*{}]/g, '');

    // If they're very similar, it's redundant
    const similarity = beforeClean.includes(insideClean) || insideClean.includes(beforeClean);

    if (similarity) {
      return `→ [red:${inside}]`;
    }
    return match; // Keep original if not redundant
  });

  return result;
}

export function formatAIContent(content: string): string {
  if (!content) return "";

  let result = content;

  // STEP 0: CRITICAL - Normalize asterisks FIRST before any other processing
  // This strips markdown emphasis (*x*, **x**), dangling asterisks (x*), and
  // removes duplicated variables (x x) caused by asterisk corruption
  result = normalizeAsterisks(result);

  // STEP -4: NORMALIZE ALL LINE BREAK TYPES FIRST
  // This ensures consistent handling regardless of source (Windows, Mac, Unicode)
  result = normalizeLineBreaks(result);

  // STEP -3.9: DISAMBIGUATE any remaining ASTERISKS
  // The AI uses * for both multiplication ({3/4}*8) and italics (*x*).
  // This masks italic tokens, converts multiplication * to ×, then unmasks.
  // MUST happen before any italic parsing or fraction masking.
  result = disambiguateAsterisks(result);

  // STEP -3.8: NORMALIZE PARENTHETICAL FRACTIONS TO BRACE SYNTAX
  // AI often emits (3x/2) instead of {3x/2}. Convert early before other processing.
  result = normalizeFractionForms(result);

  // STEP -3.5: ISOLATE LABELS (Left Side:, Right Side:, etc.)
  // This normalizes label variants and ensures they're on their own lines
  // MUST happen BEFORE joinBrokenEquationLines to prevent joining across labels
  result = isolateLabels(result);

  // STEP -3: MASK IMAGES FIRST - CRITICAL!
  // Images must be masked BEFORE step boundary detection, because image descriptions
  // often contain keywords like "graph showing" which would incorrectly trigger step markers

  // Create a local placeholders map for this specific formatting operation
  const localPlaceholders = new Map<string, string>();
  let maskCounter = 0;

  // Helper function to mask content with a unique placeholder
  // Use a format that is GUARANTEED not to be touched by any other regex patterns
  // Use uppercase letters and numbers only - no symbols that could be matched
  const maskContent = (text: string, pattern: RegExp): string => {
    return text.replace(pattern, (match) => {
      const maskId = `XXIMAGEPROTECTED${maskCounter}XX`;
      maskCounter++;
      localPlaceholders.set(maskId, match);
      return maskId;
    });
  };

  // Helper function to unmask content
  const unmaskContent = (text: string): string => {
    let unmasked = text;
    // Sort by key in reverse order to handle nested replacements correctly
    const sortedEntries = Array.from(localPlaceholders.entries()).reverse();
    sortedEntries.forEach(([maskId, original]) => {
      unmasked = unmasked.split(maskId).join(original);
    });
    return unmasked;
  };

  // IMAGES MUST BE MASKED FIRST before step keywords
  const imagePattern = /\[IMAGE:[\s\S]+?\]\([^)]+\)/gi;
  const imageMatches = result.match(imagePattern);
  result = maskContent(result, imagePattern);

  // STEP -2: NUCLEAR FIX FOR CRAMMED EQUATION STEPS
  // AI sometimes completely ignores line break instructions and crams step-by-step algebra into one line
  // Example: "Start with the equation: -4x + 1/2y = -1 Add 4x to both sides: 1/2y = 4x - 1 Multiply..."
  //
  // Strategy: Instead of trying to parse equation content (which fails with fractions, negatives, etc.),
  // we simply insert line breaks BEFORE each new instruction keyword.
  // This is keyword-boundary based, not content-based, so it's robust to any equation syntax.

  // Define all step instruction keywords that mark boundaries
  const STEP_KEYWORDS = [
    'Start with the equation',
    'Starting with the equation',
    'Start with',
    'Starting with',
    'Original equation',
    'Add',
    'Subtract',
    'Multiply',
    'Divide',
    'Simplify',
    'Combine',
    'Factor',
    'Expand',
    'Distribute',
    'Solve',
    'Rearrange',
    'Isolate',
    'Cross-multiply',
    'Cross multiply',
    'Graph',
    'Rewrite',
    'Convert',
    'Transform'
  ];

  // Escape special regex characters and create alternation pattern
  const escapedKeywords = STEP_KEYWORDS.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

  // Insert a protected marker (⟪STEP⟫) before each keyword
  // Using unicode brackets ⟪⟫ which won't conflict with subscripts, fractions, or other notation
  // This marker will survive the aggressive line break removal pipeline
  // Match: (any char) + whitespace + (keyword at word boundary)
  // Replace with: $1 + marker + $2 (preserves everything, adds protected marker)
  const stepBoundaryRegex = new RegExp(
    `(.)\\s+(${escapedKeywords})\\b`,
    'gi'
  );

  result = result.replace(stepBoundaryRegex, '$1⟪STEP⟫$2');

  // STEP -1: FORCE LINE BREAKS BETWEEN LIST ITEMS
  // This is the NUCLEAR OPTION for A-D line break problem
  // Must happen FIRST, before any other processing
  result = forceListItemLineBreaks(result);

  // STEP 0: Clean up any leaked MASK tokens from previous bad formatting
  result = cleanupMaskTokens(result);

  // STEP 0.25: CRITICAL - Remove ALL LaTeX notation that should never appear
  // Remove display math delimiters: \[ and \]
  result = result.replace(/\\\[/g, '');
  result = result.replace(/\\\]/g, '');
  // Remove inline math delimiters: \( and \)
  result = result.replace(/\\\(/g, '');
  result = result.replace(/\\\)/g, '');
  // Remove LaTeX escaped braces: \{ and \}
  result = result.replace(/\\\{/g, '{');
  result = result.replace(/\\\}/g, '}');
  // Remove other common LaTeX commands that should never appear
  result = result.replace(/\\text\{([^}]+)\}/g, '$1');
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '{$1/$2}');
  result = result.replace(/\\times/g, '×');
  result = result.replace(/\\cdot/g, '·');
  result = result.replace(/\\div/g, '÷');
  result = result.replace(/\\sqrt/g, '√');

  // CRITICAL: Fix malformed fractions with comprehensive patterns

  // 1. Fix fractions where closing brace is on next line
  // Pattern: {number\n} → {number}
  result = result.replace(/\{([^}]+)\n\s*\}/g, '{$1}');

  // 2. Fix fractions with line breaks in the middle
  // Pattern: {number/number\n} → {number/number}
  result = result.replace(/\{([^}\/]+)\/([^}]+)\n\s*\}/g, '{$1/$2}');

  // 3. Fix malformed fractions with extra spaces and asterisks inside braces
  // Pattern: { *rate*_helium_ / *rate*_nitrogen_ } → {*rate*_helium_ / *rate*_nitrogen_}
  // First, normalize spaces after opening brace
  result = result.replace(/\{\s+/g, '{');
  // Then normalize spaces before closing brace
  result = result.replace(/\s+\}/g, '}');

  // 4. Fix fractions where opening brace is separated from content by newline
  // Pattern: {\n content } → {content}
  result = result.replace(/\{\s*\n\s*/g, '{');

  // 5. Fix incomplete fractions missing closing brace at end of line
  // Pattern: { *rate*_helium_ / *rate*_nitrogen_\n → {*rate*_helium_ / *rate*_nitrogen_}
  result = result.replace(/\{([^}]+)\s*\n/g, '{$1}');

  // 6. Fix fractions with unclosed braces by finding the pattern and adding missing brace
  // Look for { followed by content with / but no closing } before next whitespace/newline/punctuation
  result = result.replace(/\{([^}]+\/[^}]+)(\s|$|,|\.|;|\))/g, '{$1}$2');

  // STEP 0.5: Fix unicode fractions and other raw notation
  result = fixRawNotation(result);

  // STEP 0.75: Fix unclosed subscripts/superscripts BEFORE masking
  result = fixUnclosedNotation(result);

  // STEP 0.8: Fix redundant answer displays (e.g., "answer: [red:answer]" → "→ [red:answer]")
  result = fixRedundantAnswers(result);

  // CRITICAL: Fix line breaks INSIDE color tags before masking
  // Pattern: "[red:text\nmore text]" → "[red:text more text]"
  // This must happen BEFORE masking so the tag remains valid
  // Use a loop to handle multiple line breaks inside a single tag
  // IMPORTANT: Match ']' OR end of string to handle incomplete tags
  let prevResult = '';
  let maxIterations = 20; // Prevent infinite loops
  let iterations = 0;
  while (prevResult !== result && iterations < maxIterations) {
    prevResult = result;
    // Match color tag opening, then any content except ']' and '\n', then a newline, then more content
    // This will repeatedly join lines until the tag is complete
    result = result.replace(/(\[(?:red|blue|green|orange|purple|yellow):[^\]]*?)\n/gi, '$1 ');
    iterations++;
  }

  // CRITICAL: Fix line breaks INSIDE fraction tags before masking
  // Pattern: "{num/\nden}" → "{num/den}"
  prevResult = '';
  iterations = 0;
  while (prevResult !== result && iterations < maxIterations) {
    prevResult = result;
    result = result.replace(/(\{[^}]*?)\n/g, '$1');
    iterations++;
  }

  // CRITICAL: Normalize fraction-adjacent digits/parens BEFORE masking fractions
  // This must happen before masking because once {1/2} becomes a mask token,
  // the pattern }(\d) won't match. Only targets true fractions {digit/digit}.
  // {1/2}6 → {1/2} × 6
  // {1/2}(x+6) → {1/2} × (x+6)
  // {1/2}x → {1/2}x (unchanged - variable coefficient is allowed)
  result = result.replace(/\{(\d+\s*\/\s*\d+)\}\s*(?=\d)/g, '{$1} × ');
  result = result.replace(/\{(\d+\s*\/\s*\d+)\}\s*(?=\()/g, '{$1} × ');

  // Now mask other patterns (images already masked at the top)
  result = maskContent(result, /\[(red|blue|green|orange|purple|yellow):.*?\]/gi);
  // CRITICAL FIX: Only mask actual fractions {num/den}, not all curly braces
  // This prevents masking algebraic grouping like {*x* - 2} which needs italic processing
  result = maskContent(result, /\{[^}]*\/[^}]*\}/g); // Fractions only (must contain /)
  result = maskContent(result, /_[^_]+_/g); // Subscripts
  result = maskContent(result, /\^[^^]+\^/g); // Superscripts

  // STEP 0.9: SMART LINE BREAK MANAGEMENT - Do this AFTER masking!
  // Strategy: Only remove line breaks that are CLEARLY errors (breaking numbers, splitting expressions)
  // PRESERVE line breaks that serve formatting purposes (multi-step calculations, separate equations)

  // === CRITICAL FIXES: Remove breaks that split atomic units ===

  // Fix decimal numbers split across lines: "0\n.055" → "0.055"
  result = result.replace(/(\d+)\s*\n\s*(\.\d+)/g, '$1$2');

  // Fix number + unit splits: "55\ngrams" → "55 grams"
  result = result.replace(/(\d+\.?\d*)\s*\n\s*([a-zA-Z]+)/g, '$1 $2');

  // Fix coordinate pairs: "(0,\n4)" → "(0, 4)" or "(0\n, 4)" → "(0, 4)"
  result = result.replace(/\((\d+\.?\d*),?\s*\n\s*(\d+\.?\d*)\)/g, '($1, $2)');
  result = result.replace(/\(\s*(\d+\.?\d*)\s*\n\s*,\s*(\d+\.?\d*)\s*\)/g, '($1, $2)');

  // CRITICAL: Fix slope/intercept patterns that break awkwardly
  // Pattern 1: "slope = -\n3/7" or "Slope: -\n3/7" → keep minus with fraction
  result = result.replace(/(slope|Slope)\s*(:|=)\s*(-?)\s*\n\s*/gi, '$1 $2 $3');
  // Pattern 2: "y-intercept = \n2" or "y-intercept:\n2" → "y-intercept = 2"
  result = result.replace(/(y-intercept|x-intercept|slope)\s*(:|=)\s*\n\s*/gi, '$1 $2 ');
  // Pattern 3: "slope and\ny-intercept" → "slope and y-intercept"
  result = result.replace(/and\s*\n\s*(y-intercept|x-intercept)/gi, 'and $1');
  // Pattern 4: Keep "slope = value,\ny-intercept = value" on same line
  result = result.replace(/(slope|Slope)\s*(:|=)\s*[^,\n]+,\s*\n\s*(y-intercept|x-intercept)/gi, (match) => match.replace(/\n\s*/g, ' '));

  // Fix fraction splits: "7.84\n/\n19.6" → "7.84/19.6"
  result = result.replace(/(\d+\.?\d*)\s*\n\s*(\/)\s*\n\s*(\d+\.?\d*)/g, '$1$2$3');
  result = result.replace(/(\d+\.?\d*)\s*\n\s*(\/)\s*(\d+\.?\d*)/g, '$1$2$3');

  // Fix multiplication operator splits: "2\n×\n3" → "2 × 3"
  result = result.replace(/(\d+\.?\d*)\s*\n\s*×\s*\n\s*(\d+\.?\d*)/g, '$1 × $2');
  result = result.replace(/×\s*\n\s*/g, '× ');
  result = result.replace(/\s*\n\s*×/g, ' ×');

  // CRITICAL: Fix breaks before + or - operators in equations
  // Pattern: "6)\n+ 7" → "6) + 7" - prevents splitting equations at operators
  result = result.replace(/(\))\s*\n\s*(\+|-)\s*/g, '$1 $2 ');
  // Pattern: "value\n+ 7" → "value + 7" (number or variable before break)
  result = result.replace(/(\d+|\*[a-z]+\*)\s*\n\s*(\+|-)\s+/gi, '$1 $2 ');

  // Fix breaks after transitional phrases (but only if followed by lowercase)
  result = result.replace(/(Solving for|hence|therefore|thus)\s*\n\s*([a-z])/gi, '$1 $2');

  // CRITICAL: Fix breaks after common short words at start of sentences
  // Pattern: "The\ngraph" → "The graph", "A\nline" → "A line"
  result = result.replace(/\b(The|A|An|This|That|These|Those|It|We|They)\s*\n\s*/g, '$1 ');

  // Fix breaks after "for" when followed by a number
  // Pattern: "for\n8 hours" → "for 8 hours"
  result = result.replace(/\bfor\s*\n\s*(\d+)/gi, 'for $1');

  // Fix square root expressions: "√\n(" → "√("
  result = result.replace(/√\s*\n\s*\(/g, '√(');

  // CRITICAL: Fix breaks after fractions before parentheses
  // Pattern: "{3/4}\n(" → "{3/4}(" - fractions followed by parenthetical expressions
  result = result.replace(/(\})\s*\n\s*(\()/g, '$1$2');

  // CRITICAL: Fix breaks between "when" and equation content
  // Pattern: "when {3/4}\n(2*x*" → "when {3/4}(2*x*"
  result = result.replace(/(when\s+[^\n]+)\s*\n\s*(\([^)]+)/gi, '$1 $2');

  // Fix breaks before punctuation: "word\n." → "word." or "value\n," → "value,"
  result = result.replace(/\s*\n\s*([.,;)])/g, '$1');

  // CRITICAL: Fix breaks before commas in slope/intercept lists
  // Pattern: "-3/7\n, y-intercept" → "-3/7, y-intercept"
  result = result.replace(/([^\s])\s*\n\s*,\s*/g, '$1, ');

  // === MODERATE FIXES: Fix breaks around operators (but be cautious) ===

  // Only remove breaks around = if NOT at start of line (preserve aligned equations)
  // Pattern: "5 x\n= 10" → "5 x = 10", but preserve "\n     = 10" (aligned)
  result = result.replace(/([^\s])\s*\n\s*=/g, '$1 =');

  // Remove breaks AFTER = only if next line doesn't start with spaces (not aligned)
  result = result.replace(/=\s*\n(?!\s{3,})/g, '= ');

  // CRITICAL: Do NOT remove line breaks after colons that end instructional phrases
  // These patterns indicate the colon is ending an instruction, and the next line is the work:
  // "Multiply every term by 2:\n*y* = 8*x* - 2" should STAY as is
  // Only fix colons followed by lowercase continuation words in same sentence
  // Example fix: "The slope is: m = 2" → "The slope is m = 2"
  result = result.replace(/:\s*\n\s*(and|or|so|which|where|that|because)\s+/gi, ': $1 ');

  // === PRESERVE THESE LINE BREAKS ===
  // DO NOT remove line breaks:
  // 1. After arrows (→) - these mark end of calculation steps
  // 2. Before new equations starting with spaces (aligned multi-step)
  // 3. Double newlines (paragraph breaks)
  // 4. Before "Step 1", "Step 2", etc.

  // Clean up excessive spaces
  result = result.replace(/  +/g, ' ');

  // 3. Restore protected tokens
  result = unmaskContent(result);

  // STEP FINAL: Convert protected markers to actual newlines
  // Both LIST_BREAK and ⟪STEP⟫ must happen AFTER all aggressive line break removal
  result = result.replace(/LIST_BREAK/g, '\n\n');
  result = result.replace(/⟪STEP⟫/g, '\n\n');

  // Clean up any stray underscores that may have appeared before step keywords
  // This can happen if subscript processing incorrectly treated keywords as variables
  STEP_KEYWORDS.forEach(keyword => {
    const pattern = new RegExp(`_\\s*(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    result = result.replace(pattern, ' $1');
  });

  // FINAL SAFETY: Remove any remaining MASK tokens that somehow survived
  result = cleanupMaskTokens(result);

  // FINAL CLEANUP: Remove stray underscores (leftover from subscript processing or AI output)
  // Pattern: "47_. " → "47. " or "47_ " → "47 "
  result = result.replace(/(\d+)_+\./g, '$1.');
  result = result.replace(/(\d+)_+\s/g, '$1 ');
  result = result.replace(/(\d+)_+,/g, '$1,');
  // Pattern: "6_)" → "6)" - underscore before closing parenthesis
  result = result.replace(/(\d+)_+\)/g, '$1)');
  // Pattern: "6_+" or "6_-" → "6 +" - underscore before operator
  result = result.replace(/(\d+)_+([+\-*/])/g, '$1 $2');
  // Pattern: "problem_41" → "problem 41"
  result = result.replace(/\b(problem|exercise|question)_+(\d+)/gi, '$1 $2');

  // CRITICAL: Remove stray isolated dashes that appear on their own line
  // These are artifacts from equation addition lines or AI formatting errors
  // Pattern: A line containing only whitespace and 1-3 dashes (not a proper divider line)
  // Keep proper divider lines (4+ dashes) but remove orphan dashes
  result = result.replace(/^\s*-{1,3}\s*$/gm, '');
  // Also remove lines with just a single dash after a proper divider line
  result = result.replace(/([-]{4,})\s*\n\s*-\s*\n/g, '$1\n\n');

  // CRITICAL: Finalize to strip any leaked internal tokens
  return finalizeFormattedText(result, "formatAIContent");
}

/**
 * CRITICAL: Lightweight prose formatter for summary/explanation text.
 * This function applies essential math formatting (fractions, subscripts, colors)
 * WITHOUT the aggressive step boundary detection that formatAIContent uses.
 *
 * The step boundary detection inserts newlines before keywords like "expand",
 * "combine", "simplify" which is correct for equation blocks but WRONG for
 * prose like "We expand each side and combine like terms to simplify."
 *
 * @param content - The prose content to format
 * @returns Formatted content safe for rendering
 */
export function formatProseContent(content: string): string {
  if (!content) return "";

  let result = content;

  // Normalize line breaks
  result = normalizeLineBreaks(result);

  // Normalize asterisks (strip markdown emphasis)
  result = normalizeAsterisks(result);

  // Disambiguate remaining asterisks
  result = disambiguateAsterisks(result);

  // Normalize parenthetical fractions to brace syntax
  result = normalizeFractionForms(result);

  // Fix unicode fractions and raw notation
  result = fixRawNotation(result);

  // Fix unclosed subscripts/superscripts
  result = fixUnclosedNotation(result);

  // Clean up mask tokens
  result = cleanupMaskTokens(result);

  // Remove LaTeX notation
  result = result.replace(/\\\[/g, '');
  result = result.replace(/\\\]/g, '');
  result = result.replace(/\\\(/g, '');
  result = result.replace(/\\\)/g, '');
  result = result.replace(/\\text\{([^}]+)\}/g, '$1');
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '{$1/$2}');
  result = result.replace(/\\times/g, '×');
  result = result.replace(/\\cdot/g, '·');
  result = result.replace(/\\div/g, '÷');

  // Clean up excessive whitespace (but preserve single newlines for paragraph breaks)
  result = result.replace(/  +/g, ' ');
  result = result.replace(/\n{3,}/g, '\n\n');

  // Finalize
  return finalizeFormattedText(result.trim(), "formatProseContent");
}

// ============================================================================
// STEP INTENT INFERENCE: Pedagogical badges for step actions
// ============================================================================

import type { StepAction, BothSidesOpType, BothSidesOperation } from "../types/homework";

/**
 * Infer the pedagogical action being performed in a step.
 * This analyzes the step text (title, content, equation) to determine
 * what mathematical operation is being performed, enabling UI badges
 * that help students understand the purpose of each transformation.
 *
 * @param text - Combined text from step title, content, and equation
 * @returns Object with action type and human-friendly label
 */
export function inferStepAction(text: string): { action: StepAction; label: string } {
  const t = (text || "").toLowerCase();

  // Check for final answer indicators first (highest priority)
  if (/(final answer|therefore|thus|answer:|the answer is|solution is)/.test(t)) {
    return { action: "final", label: "Final answer" };
  }

  // Check/verify step
  if (/(check|verify|plug(ging)? in|substitut(e|ing) back|confirm)/.test(t)) {
    return { action: "check", label: "Check" };
  }

  // Distribution/expansion
  if (/(distribut|expand|foil|multiply out)/.test(t)) {
    return { action: "distribute", label: "Distribute" };
  }

  // Combining like terms
  if (/(combine like terms|collect like terms|group like terms|add like terms)/.test(t)) {
    return { action: "combine_like_terms", label: "Combine like terms" };
  }

  // Simplification
  if (/(simplif|reduce|clean up|cancel)/.test(t)) {
    return { action: "simplify", label: "Simplify" };
  }

  // Add/subtract both sides (check both orderings)
  if (/(add|subtract).*(both sides|each side)|both sides.*(add|subtract)|(adding|subtracting).*(from both|to both)/.test(t)) {
    return { action: "add_subtract_both_sides", label: "Add/Subtract both sides" };
  }

  // Multiply/divide both sides (check both orderings)
  if (/(multiply|divide).*(both sides|each side)|both sides.*(multiply|divide)|(multiplying|dividing).*(both sides)/.test(t)) {
    return { action: "multiply_divide_both_sides", label: "Multiply/Divide both sides" };
  }

  // Isolating variable
  if (/(isolate|solve for|get .* alone|move .* to|rearrange for)/.test(t)) {
    return { action: "isolate_variable", label: "Isolate variable" };
  }

  // Factoring
  if (/(factor|factoring|factor out)/.test(t)) {
    return { action: "factor", label: "Factor" };
  }

  // Substitution
  if (/(substitut|plug in|replace|let .* =)/.test(t)) {
    return { action: "substitute", label: "Substitute" };
  }

  // Evaluation/calculation
  if (/(evaluate|compute|calculate|find the value|work out)/.test(t)) {
    return { action: "evaluate", label: "Evaluate" };
  }

  // Default to rewrite for setup/initial steps
  return { action: "rewrite", label: "Rewrite" };
}

// ============================================================================
// BOTH SIDES OPERATION EXTRACTION: Visual feedback for equation balance
// ============================================================================

/**
 * Extract "both sides" operation from step text.
 * Detects patterns like "Add 11 to both sides", "Subtract 3x from both sides",
 * "Multiply both sides by 2", "Divide both sides by 4".
 *
 * This enables visual feedback showing the operation applied equally,
 * e.g., "+ 11 = + 11" displayed between equations.
 *
 * @param text - Combined text from step title, content, and equation
 * @returns BothSidesOperation if detected, undefined otherwise
 */
export function extractBothSidesOp(text: string): BothSidesOperation | undefined {
  const t = (text || "").toLowerCase();

  // Pattern 1: "add X to both sides" or "adding X to both sides"
  // Captures: numbers, fractions {1/2}, variables *x*, expressions like "3x"
  const addPattern = /(?:add|adding)\s+([^\s]+(?:\s*[^\s]+)?)\s+to\s+(?:both\s+sides|each\s+side)/i;
  const addMatch = text.match(addPattern);
  if (addMatch) {
    return { type: "add", value: cleanOperandValue(addMatch[1]) };
  }

  // Pattern 2: "subtract X from both sides" or "subtracting X from both sides"
  const subtractPattern = /(?:subtract|subtracting)\s+([^\s]+(?:\s*[^\s]+)?)\s+from\s+(?:both\s+sides|each\s+side)/i;
  const subtractMatch = text.match(subtractPattern);
  if (subtractMatch) {
    return { type: "subtract", value: cleanOperandValue(subtractMatch[1]) };
  }

  // Pattern 3: "multiply both sides by X" or "multiplying both sides by X"
  const multiplyPattern = /(?:multiply|multiplying)\s+(?:both\s+sides|each\s+side)\s+by\s+([^\s.,]+(?:\s*[^\s.,]+)?)/i;
  const multiplyMatch = text.match(multiplyPattern);
  if (multiplyMatch) {
    return { type: "multiply", value: cleanOperandValue(multiplyMatch[1]) };
  }

  // Pattern 4: "divide both sides by X" or "dividing both sides by X"
  const dividePattern = /(?:divide|dividing)\s+(?:both\s+sides|each\s+side)\s+by\s+([^\s.,]+(?:\s*[^\s.,]+)?)/i;
  const divideMatch = text.match(dividePattern);
  if (divideMatch) {
    return { type: "divide", value: cleanOperandValue(divideMatch[1]) };
  }

  // Pattern 5: Inverted order - "both sides + X" or "X added to both sides"
  const addedPattern = /([^\s]+)\s+(?:added|is\s+added)\s+to\s+(?:both\s+sides|each\s+side)/i;
  const addedMatch = text.match(addedPattern);
  if (addedMatch) {
    return { type: "add", value: cleanOperandValue(addedMatch[1]) };
  }

  // Pattern 6: Inverted - "X subtracted from both sides"
  const subtractedPattern = /([^\s]+)\s+(?:subtracted|is\s+subtracted)\s+from\s+(?:both\s+sides|each\s+side)/i;
  const subtractedMatch = text.match(subtractedPattern);
  if (subtractedMatch) {
    return { type: "subtract", value: cleanOperandValue(subtractedMatch[1]) };
  }

  return undefined;
}

/**
 * Clean up the operand value extracted from text.
 * Handles removing trailing punctuation, normalizing whitespace, etc.
 */
function cleanOperandValue(value: string): string {
  let cleaned = value.trim();
  // Remove trailing punctuation
  cleaned = cleaned.replace(/[.,;:]+$/, "");
  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, " ");
  return cleaned;
}

/**
 * Formats an entire solution object, processing all step content and final answer
 * CRITICAL: Uses formatTitle for step titles to ensure no line breaks
 * CRITICAL: Applies consistent variable highlighting across all steps
 * CRITICAL: Infers step action for pedagogical badges
 * CRITICAL: Extracts both-sides operations for visual balance feedback
 */
export function formatSolution(solution: {
  problem: string;
  steps: Array<{
    id: string;
    title: string;
    equation?: string;
    rawEquation?: string;
    content?: string;
    summary?: string;
    explanation?: string
  }>;
  finalAnswer: string | { parts: string[] };
}): typeof solution & { steps: Array<{ action?: string; actionLabel?: string; bothSidesOp?: BothSidesOperation }> } {
  // STEP 1: Build color map from ALL text in solution (for consistent coloring)
  const allText = [
    solution.problem,
    ...solution.steps.flatMap(s => [s.equation, s.rawEquation, s.content, s.summary, s.explanation]),
    typeof solution.finalAnswer === 'string'
      ? solution.finalAnswer
      : solution.finalAnswer.parts.join(' ')
  ].filter(Boolean).join(' ');

  const colorMap = buildVarColorMap(allText);

  // STEP 2: Format and apply colors to all fields
  // Use formatAIContent for equations (needs step boundary detection)
  const applyFormat = (text: string | undefined): string | undefined => {
    if (!text) return undefined;
    const formatted = formatAIContent(text);
    return applyVarColors(formatted, colorMap);
  };

  // CRITICAL FIX: Use formatProseContent for summary/explanation
  // This avoids the aggressive step boundary detection that inserts newlines
  // before keywords like "expand", "combine", "simplify" which breaks prose
  const applyProseFormat = (text: string | undefined): string | undefined => {
    if (!text) return undefined;
    const formatted = formatProseContent(text);
    return applyVarColors(formatted, colorMap);
  };

  return {
    problem: applyFormat(solution.problem) ?? '',
    steps: solution.steps.map((step, index) => {
      // STEP 3: Infer step action from combined text (title + content + equation)
      const signalText = [step.title, step.content, step.equation].filter(Boolean).join('\n');
      const { action, label } = inferStepAction(signalText);

      // For the last step, prefer "final" action if not already detected
      const isLastStep = index === solution.steps.length - 1;
      const finalAction = isLastStep && action === "rewrite" ? "final" : action;
      const finalLabel = isLastStep && action === "rewrite" ? "Final answer" : label;

      // STEP 4: Extract both-sides operation for visual balance feedback
      const bothSidesOp = extractBothSidesOp(signalText);

      return {
        ...step,
        title: formatTitle(step.title), // Titles don't get variable colors (too short)
        equation: applyFormat(step.equation),
        rawEquation: step.rawEquation, // Preserve raw equation - DO NOT format or colorize
        content: applyFormat(step.content),
        summary: applyProseFormat(step.summary), // CRITICAL: Use prose formatter for summaries
        explanation: applyProseFormat(step.explanation), // CRITICAL: Use prose formatter for explanations
        action: finalAction,
        actionLabel: finalLabel,
        bothSidesOp,
      };
    }),
    finalAnswer: typeof solution.finalAnswer === 'string'
      ? applyFormat(solution.finalAnswer) ?? ''
      : {
          parts: solution.finalAnswer.parts.map(part => applyFormat(part) ?? '')
        },
  };
}

// ============================================================================
// CANONICAL ENTRYPOINT: formatForMathText (Recommendation 8)
// ============================================================================

/**
 * CRITICAL: Single canonical entrypoint for formatting text that will be rendered in MathText.
 *
 * This function establishes the "MathText input contract" - any text passed to MathText
 * should go through this function first, ensuring:
 * 1. Consistent formatting across all render paths
 * 2. No duplicated formatting between contentFormatter and MathText
 * 3. All internal markers are stripped (finalized)
 * 4. The output is branded as FormattedMathString
 *
 * @param input - The raw text to format
 * @param context - A debug context string (e.g., "step:1:equation") for error tracking
 * @returns FormattedMathString - Text safe to render in MathText without further processing
 */
export function formatForMathText(input: string, context = "unknown"): FormattedMathString {
  let s = input ?? "";

  // Empty strings are already "formatted"
  if (!s.trim()) {
    return s as FormattedMathString;
  }

  // Apply the full content formatting pipeline
  // formatAIContent is our top-level content normalizer that handles:
  // - Line break normalization
  // - Label isolation
  // - Fraction normalization
  // - Asterisk disambiguation
  // - List item formatting
  // - And calls finalizeFormattedText at the end
  s = formatAIContent(s);

  // At this point, s has been through the complete pipeline and finalized.
  // The finalizeFormattedText call inside formatAIContent ensures no internal
  // markers leak through.

  return s as FormattedMathString;
}

/**
 * Format text specifically for title display (single-line, no breaks).
 * Returns a FormattedMathString suitable for MathText in "title" mode.
 */
export function formatTitleForMathText(input: string, context = "unknown"): FormattedMathString {
  const s = formatTitle(input ?? "");
  return s as FormattedMathString;
}

/**
 * Format text specifically for prose display (collapsed newlines).
 * Returns a FormattedMathString suitable for MathText in "prose" mode.
 */
export function formatProseForMathText(input: string, context = "unknown"): FormattedMathString {
  let s = input ?? "";
  if (!s.trim()) {
    return s as FormattedMathString;
  }

  // For prose, we want newlines collapsed to spaces
  s = normalizeLineBreaks(s);
  s = s.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  s = finalizeFormattedText(s, `formatProseForMathText:${context}`);

  return s as FormattedMathString;
}

/**
 * Format text specifically for equation display (preserves structure).
 * Returns a FormattedMathString suitable for MathText in "equation" mode.
 */
export function formatEquationForMathText(input: string, context = "unknown"): FormattedMathString {
  const s = formatEquationText(input ?? "");
  return s as FormattedMathString;
}

/**
 * Unified preprocessing function for math content
 * Use this to ensure consistent preprocessing across all render paths.
 *
 * @param text - The text to preprocess
 * @param mode - The rendering mode:
 *   - "title": Collapses ALL whitespace to single spaces (for step titles)
 *   - "prose": Collapses newlines to spaces (for summaries/explanations)
 *   - "equation": Preserves intentional line breaks while fixing broken expressions
 */
export type MathRenderMode = "title" | "prose" | "equation";

export function preprocessMathContent(text: string, mode: MathRenderMode): string {
  if (!text) return "";

  let result = normalizeLineBreaks(text);

  if (mode === "title") {
    // Titles should NEVER have line breaks
    result = result.replace(/\s+/g, ' ').trim();
    return finalizeFormattedText(result, "preprocessMathContent:title");
  }

  if (mode === "prose") {
    // Prose collapses newlines to spaces
    result = result
      .replace(/\s*\n+\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return finalizeFormattedText(result, "preprocessMathContent:prose");
  }

  // For equation mode, apply full equation preprocessing
  // CRITICAL: isolateLabels must come first to ensure proper line breaks
  result = isolateLabels(result);
  result = normalizeFractions(result);
  result = normalizeFractionMultiplication(result);
  result = removeNewlinesInsideDelimiters(result);
  result = joinBrokenEquationLines(result);
  result = normalizeAdjacentFractions(result);

  return finalizeFormattedText(result.trim(), "preprocessMathContent:equation");
}

// ============================================================================
// VARIABLE HIGHLIGHTING: Consistent color assignment across steps
// ============================================================================

/**
 * Available colors for variable highlighting.
 * These are MathText color tag names that render distinctly.
 */
const VAR_COLORS = ["blue", "green", "orange", "purple"] as const;
type VarColor = (typeof VAR_COLORS)[number];

/**
 * Extract all single-letter variables from text.
 * Matches patterns like: x, y, m, b, *x*, *y*, etc.
 * Returns unique variables in order of first appearance.
 *
 * @param text - The text to scan for variables
 * @returns Array of unique single-letter variables (lowercase)
 */
function extractSingleLetterVars(text: string): string[] {
  const seen = new Set<string>();
  const vars: string[] = [];

  // Pattern 1: Italic variables like *x*, *y*, *m*
  const italicPattern = /\*([a-zA-Z])\*/g;
  let match;
  while ((match = italicPattern.exec(text)) !== null) {
    const v = match[1].toLowerCase();
    if (!seen.has(v)) {
      seen.add(v);
      vars.push(v);
    }
  }

  // Pattern 2: Standalone single letters in math contexts
  // Look for: letter followed by operator, equals, space+digit, or subscript
  // Examples: "x = 5", "y + 3", "m_1", "b = 2"
  // Avoid: words like "a dog", "the", etc.
  const standalonePattern = /(?:^|[\s=+\-×÷*/(]|:)([a-zA-Z])(?=[\s=+\-×÷*/)\]_^]|$)/g;
  while ((match = standalonePattern.exec(text)) !== null) {
    const v = match[1].toLowerCase();
    // Skip common words/articles that might match
    if (!seen.has(v) && !["a", "i"].includes(v)) {
      seen.add(v);
      vars.push(v);
    }
  }

  return vars;
}

/**
 * Build a map of variable -> color for consistent highlighting.
 * Variables are assigned colors in order of first appearance.
 *
 * @param allText - Combined text from all steps to scan
 * @returns Map of variable letter to color name
 */
function buildVarColorMap(allText: string): Map<string, VarColor> {
  const vars = extractSingleLetterVars(allText);
  const map = new Map<string, VarColor>();

  vars.forEach((v, i) => {
    // Cycle through colors if more variables than colors
    map.set(v, VAR_COLORS[i % VAR_COLORS.length]);
  });

  return map;
}

/**
 * Apply consistent color highlighting to variables in text.
 * Wraps each variable occurrence with the appropriate color tag.
 *
 * @param text - The text to colorize
 * @param colorMap - Map of variable -> color from buildVarColorMap
 * @returns Text with color tags applied to variables
 */
function applyVarColors(text: string, colorMap: Map<string, VarColor>): string {
  if (colorMap.size === 0) return text;

  let result = text;

  // Process each variable in the color map
  colorMap.forEach((color, varLetter) => {
    // Pattern 1: Replace italic variables *x* → [blue:*x*]
    // But skip if already inside a color tag
    const italicPattern = new RegExp(
      `(?<!\\[[a-z]+:)\\*${varLetter}\\*(?![^\\[]*\\])`,
      "gi"
    );
    result = result.replace(italicPattern, `[${color}:*${varLetter}*]`);

    // Pattern 2: Replace standalone variables in equation contexts
    // Match: (start/operator/space) + letter + (operator/space/end)
    // But only if not already in a color tag or italic
    const standalonePattern = new RegExp(
      `(?<!\\[[a-z]+:[^\\]]*)(?<!\\*)\\b${varLetter}\\b(?!\\*)(?![^\\[]*\\])`,
      "gi"
    );
    result = result.replace(standalonePattern, `[${color}:${varLetter}]`);
  });

  return result;
}

// ============================================================================
// TEST HOOKS: Exported for unit testing (Recommendation 9)
// ============================================================================

/**
 * Internal test hooks for unit testing the formatting pipeline.
 * These expose internal functions that would otherwise be private,
 * allowing tests to verify specific formatting behaviors.
 *
 * USAGE: Import in test files only:
 * import { __formattingTestHooks__ } from '../contentFormatter';
 */
export const __formattingTestHooks__ = {
  // Internal artifact detection
  FORMAT_LEAK_REGEXES,
  stripInternalArtifacts,
  assertNoInternalArtifacts,
  finalizeFormattedText,
  cleanupMaskTokens,

  // Masking operations
  maskItalicsTokens,
  unmaskTokens,

  // Equation processing
  normalizeFractions,
  normalizeFractionForms,
  normalizeFractionMultiplication,
  normalizeAdjacentFractions,
  fixUnclosedNotation,
  fixRedundantAnswers,

  // Line break handling
  isLabelLine,
  isIncompleteEquationLine,
  startsWithContinuation,
  startsNewEquation,

  // List processing
  forceListItemLineBreaks,

  // Variable highlighting
  VAR_COLORS,
  extractSingleLetterVars,
  buildVarColorMap,
  applyVarColors,

  // Step action inference
  inferStepAction,

  // Both sides operation extraction
  extractBothSidesOp,
  cleanOperandValue,
};
