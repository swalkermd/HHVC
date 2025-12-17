/**
 * Unit Tests for Content Formatter
 *
 * These tests verify the formatting pipeline catches known regression patterns:
 * - No internal mask/placeholder token leakage
 * - Superscript auto-closing (x^2 → x^2^)
 * - Parenthetical fractions → brace fractions
 * - Fraction-adjacent multiplication consistency
 * - Label isolation (Left Side/Right Side on own lines)
 * - No duplicate answer patterns
 *
 * Run with: bun src/utils/__tests__/contentFormatter.test.ts
 */

import {
  formatAIContent,
  formatEquationText,
  formatTitle,
  formatForMathText,
  formatTitleForMathText,
  formatProseForMathText,
  formatEquationForMathText,
  normalizeEquationBlockForExtraction,
  normalizeFractionForms,
  isolateLabels,
  disambiguateAsterisks,
  normalizeLineBreaks,
  removeNewlinesInsideDelimiters,
  joinBrokenEquationLines,
  detectContentKind,
  formatByKind,
  __formattingTestHooks__,
} from "../contentFormatter";

const {
  FORMAT_LEAK_REGEXES,
  stripInternalArtifacts,
  finalizeFormattedText,
  cleanupMaskTokens,
  maskItalicsTokens,
  unmaskTokens,
  normalizeFractions,
  normalizeFractionMultiplication,
  normalizeAdjacentFractions,
  fixUnclosedNotation,
  fixRedundantAnswers,
  isLabelLine,
  isIncompleteEquationLine,
  startsWithContinuation,
  startsNewEquation,
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
} = __formattingTestHooks__;

// =============================================================================
// Simple Test Framework
// =============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

interface SuiteResult {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
}

const suites: SuiteResult[] = [];
let currentSuite: SuiteResult | null = null;

function describe(name: string, fn: () => void): void {
  currentSuite = { name, tests: [], passed: 0, failed: 0 };
  suites.push(currentSuite);
  fn();
  currentSuite = null;
}

function test(name: string, fn: () => void): void {
  if (!currentSuite) {
    console.error("test() must be called inside describe()");
    return;
  }

  try {
    fn();
    currentSuite.tests.push({ name, passed: true });
    currentSuite.passed++;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    currentSuite.tests.push({ name, passed: false, error });
    currentSuite.failed++;
  }
}

function expect<T>(actual: T) {
  return {
    toBe(expected: T): void {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    },
    toBeNull(): void {
      if (actual !== null) {
        throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
      }
    },
    toBeDefined(): void {
      if (actual === undefined) {
        throw new Error(`Expected value to be defined, got undefined`);
      }
    },
    toBeUndefined(): void {
      if (actual !== undefined) {
        throw new Error(`Expected undefined, got ${JSON.stringify(actual)}`);
      }
    },
    toContain(expected: string): void {
      if (typeof actual === "string" && !actual.includes(expected)) {
        throw new Error(`Expected "${actual}" to contain "${expected}"`);
      } else if (Array.isArray(actual) && !actual.includes(expected)) {
        throw new Error(`Expected array to contain "${expected}"`);
      } else if (typeof actual !== "string" && !Array.isArray(actual)) {
        throw new Error(`Expected string or array, got ${typeof actual}`);
      }
    },
    not: {
      toContain(expected: string): void {
        if (typeof actual === "string" && actual.includes(expected)) {
          throw new Error(`Expected "${actual}" to NOT contain "${expected}"`);
        }
      },
      toMatch(pattern: RegExp): void {
        if (typeof actual === "string" && pattern.test(actual)) {
          throw new Error(`Expected "${actual}" to NOT match ${pattern}`);
        }
      },
    },
    toMatch(pattern: RegExp): void {
      if (typeof actual !== "string" || !pattern.test(actual)) {
        throw new Error(`Expected "${actual}" to match ${pattern}`);
      }
    },
    toBeGreaterThan(expected: number): void {
      if (typeof actual !== "number" || actual <= expected) {
        throw new Error(`Expected ${actual} to be greater than ${expected}`);
      }
    },
    get length(): { toBe: (expected: number) => void } {
      return {
        toBe: (expected: number): void => {
          const len = Array.isArray(actual) ? actual.length :
                     (actual && typeof (actual as any).length === "number") ? (actual as any).length :
                     (actual && typeof (actual as any).size === "number") ? (actual as any).size : 0;
          if (len !== expected) {
            throw new Error(`Expected length ${expected}, got ${len}`);
          }
        }
      };
    },
    get size(): { toBe: (expected: number) => void } {
      return {
        toBe: (expected: number): void => {
          const size = (actual as any)?.size ?? 0;
          if (size !== expected) {
            throw new Error(`Expected size ${expected}, got ${size}`);
          }
        }
      };
    },
  };
}

// =============================================================================
// TEST SUITE 1: No Internal Token Leakage
// =============================================================================

describe("No Internal Token Leakage", () => {
  const LEAK_PATTERNS = FORMAT_LEAK_REGEXES;

  // Helper function to check for any token leakage
  function assertNoLeakage(text: string): void {
    for (const rx of LEAK_PATTERNS) {
      rx.lastIndex = 0;
      const match = rx.exec(text);
      if (match !== null) {
        throw new Error(`Found leaked token: ${match[0]}`);
      }
    }
  }

  test("formatAIContent should not leak IMASK tokens", () => {
    const input = "{3/4}*x* + {1/2}*y* = *z*";
    const result = formatAIContent(input);
    assertNoLeakage(result);
    expect(result).not.toContain("IMASK");
  });

  test("formatAIContent should not leak MASK tokens", () => {
    const input = "[red:answer] and {3/4} with *x*^2^";
    const result = formatAIContent(input);
    assertNoLeakage(result);
    expect(result).not.toContain("MASK");
    expect(result).not.toContain("PLACEHOLDER");
  });

  test("formatAIContent should not leak XXIMAGEPROTECTED tokens", () => {
    const input = "[IMAGE: A graph showing y = 2x](file:///path/to/image.png) Start with the equation";
    const result = formatAIContent(input);
    assertNoLeakage(result);
    expect(result).not.toContain("XXIMAGEPROTECTED");
  });

  test("formatAIContent should not leak LIST_BREAK markers", () => {
    const input = "This is a long sentence that has options A. First B. Second C. Third D. Fourth";
    const result = formatAIContent(input);
    assertNoLeakage(result);
    expect(result).not.toContain("LIST_BREAK");
  });

  test("formatAIContent should not leak STEP markers", () => {
    const input = "Start with the equation: x + 5 = 10 Subtract 5 from both sides: x = 5";
    const result = formatAIContent(input);
    assertNoLeakage(result);
    expect(result).not.toContain("⟪STEP⟫");
  });

  test("formatEquationText should not leak tokens", () => {
    const input = "{3/4}*x* + *y*^2^";
    const result = formatEquationText(input);
    assertNoLeakage(result);
  });

  test("formatForMathText should not leak tokens", () => {
    const input = "The answer is *x* = {3/4} where *x*^2^ is the result";
    const result = formatForMathText(input, "test");
    assertNoLeakage(result);
  });

  test("stripInternalArtifacts removes all known patterns", () => {
    const corrupted = "text IMASK0IMASK more MASK123 stuff _MASK456_ PLACEHOLDER_789 XXIMAGEPROTECTED0XX end";
    const cleaned = stripInternalArtifacts(corrupted);
    expect(cleaned).not.toContain("IMASK");
    expect(cleaned).not.toContain("MASK");
    expect(cleaned).not.toContain("PLACEHOLDER");
    expect(cleaned).not.toContain("XXIMAGEPROTECTED");
  });
});

// =============================================================================
// TEST SUITE 2: Superscript Auto-Closing
// =============================================================================

describe("Superscript Auto-Closing", () => {
  test("auto-closes x^2 to x^2^", () => {
    const result = fixUnclosedNotation("x^2 + 3");
    expect(result).toContain("x^2^");
  });

  test("auto-closes (0.06)^2 to (0.06)^2^", () => {
    const result = fixUnclosedNotation("(0.06)^2 = 0.0036");
    expect(result).toContain("(0.06)^2^");
  });

  test("auto-closes 4.08^2 to 4.08^2^", () => {
    const result = fixUnclosedNotation("4.08^2 = 16.6464");
    expect(result).toContain("4.08^2^");
  });

  test("converts parenthetical exponents ^(-1) to ^-1^", () => {
    const result = fixUnclosedNotation("tan^(-1)(x)");
    expect(result).toContain("tan^-1^");
  });

  test("preserves already-closed superscripts", () => {
    const input = "x^2^ + y^3^";
    const result = fixUnclosedNotation(input);
    expect(result).not.toContain("^^");
    expect(result).toContain("x^2^");
    expect(result).toContain("y^3^");
  });
});

// =============================================================================
// TEST SUITE 3: Parenthetical Fractions → Brace Fractions
// =============================================================================

describe("Parenthetical to Brace Fractions", () => {
  test("converts (3/4) to {3/4}", () => {
    const result = normalizeFractionForms("The answer is (3/4)");
    expect(result).toContain("{3/4}");
    expect(result).not.toContain("(3/4)");
  });

  test("converts (3x/4) to {3x/4}", () => {
    const result = normalizeFractionForms("slope = (3x/4)");
    expect(result).toContain("{3x/4}");
  });

  test("converts (-3/4) to {-3/4}", () => {
    const result = normalizeFractionForms("result = (-3/4)");
    expect(result).toContain("{-3/4}");
  });

  test("converts (x/2) to {x/2}", () => {
    const result = normalizeFractionForms("half is (x/2)");
    expect(result).toContain("{x/2}");
  });

  test("preserves word/word ratios like opposite/adjacent", () => {
    const result = normalizeFractionForms("tan = opposite/adjacent");
    expect(result).not.toContain("{opposite/adjacent}");
    expect(result).toContain("opposite∕adjacent");
  });

  test("preserves file URLs", () => {
    const result = normalizeFractionForms("image at file:///var/mobile/path/to/file.png");
    expect(result).toContain("file:///var/mobile/path/to/file.png");
  });
});

// =============================================================================
// TEST SUITE 4: Fraction-Adjacent Multiplication
// =============================================================================

describe("Fraction-Adjacent Multiplication", () => {
  test("{3/4}8 becomes {3/4} × 8", () => {
    const result = normalizeFractionMultiplication("{3/4}8");
    expect(result).toBe("{3/4} × 8");
  });

  test("{1/2}(x+1) becomes {1/2} × (x+1)", () => {
    const result = normalizeFractionMultiplication("{1/2}(x+1)");
    expect(result).toContain("{1/2} × (");
  });

  test("{3/4}*8 becomes {3/4} × 8", () => {
    const result = normalizeFractionMultiplication("{3/4}*8");
    expect(result).toContain("{3/4} × ");
  });

  test("{3/4}x remains {3/4}x (variable coefficient)", () => {
    const result = normalizeFractionMultiplication("{3/4}x");
    expect(result).toBe("{3/4}x");
  });

  test("formatAIContent handles fraction-digit adjacency", () => {
    const result = formatAIContent("{3/4}8 = 6");
    expect(result).toContain("× 8");
  });
});

// =============================================================================
// TEST SUITE 5: Label Isolation
// =============================================================================

describe("Label Isolation", () => {
  test("isolates Left Side: on its own line", () => {
    const result = isolateLabels("equation Left Side: x + 5");
    expect(result).toContain("\n\nLeft Side:\n");
  });

  test("isolates Right Side: on its own line", () => {
    const result = isolateLabels("equation Right Side: x + 5");
    expect(result).toContain("\n\nRight Side:\n");
  });

  test("normalizes Left-hand side: to Left Side:", () => {
    const result = isolateLabels("Left-hand side: x = 5");
    expect(result).toContain("Left Side:");
    expect(result).not.toContain("Left-hand side:");
  });

  test("normalizes Right-hand side: to Right Side:", () => {
    const result = isolateLabels("Right-hand side: y = 10");
    expect(result).toContain("Right Side:");
    expect(result).not.toContain("Right-hand side:");
  });

  test("isLabelLine correctly identifies labels", () => {
    expect(isLabelLine("Left Side:")).toBe(true);
    expect(isLabelLine("Right Side:")).toBe(true);
    expect(isLabelLine("Step 1:")).toBe(true);
    expect(isLabelLine("Original equation:")).toBe(true);
    expect(isLabelLine("x + 5 = 10")).toBe(false);
    expect(isLabelLine("The answer is")).toBe(false);
  });
});

// =============================================================================
// TEST SUITE 6: No Duplicate Answer Patterns
// =============================================================================

describe("No Duplicate Answer Patterns", () => {
  test("removes redundant equation = value → [red:value]", () => {
    const input = "pi × (4 cm)² = 16pi cm² → [red:16pi cm²]";
    const result = fixRedundantAnswers(input);
    expect(result).not.toMatch(/= 16pi cm² →/);
    expect(result).toContain("[red:16pi cm²]");
  });

  test("removes orphaned for : fragments", () => {
    const input = "for : y = 8x - 2";
    const result = fixRedundantAnswers(input);
    expect(result).not.toMatch(/for\s*:/);
    expect(result).toContain("y = 8x - 2");
  });

  test("removes redundant text: [red:text] pattern", () => {
    const input = "The slope is m = -3/8 x + 4: [red:m = -3/8 x + 4]";
    const result = fixRedundantAnswers(input);
    expect(result).toContain("[red:");
  });
});

// =============================================================================
// TEST SUITE 7: Asterisk Disambiguation
// =============================================================================

describe("Asterisk Disambiguation", () => {
  test("preserves italic *x* while converting multiplication", () => {
    const result = disambiguateAsterisks("{3/4}*8");
    expect(result).toContain("× 8");
  });

  test("preserves *x* as italics", () => {
    const result = disambiguateAsterisks("*x* + 5");
    expect(result).toBe("*x* + 5");
  });

  test("handles {3/2}*x* - fraction followed by italic variable stays together", () => {
    // This is actually correct behavior: {3/2}*x* is a coefficient times variable
    // NOT multiplication. The asterisk is part of the italic marker, not multiplication.
    const result = disambiguateAsterisks("{3/2}*x*");
    // The function correctly preserves this as-is since *x* is an italic marker
    expect(result).toBe("{3/2}*x*");
  });

  test("handles 2*x* + 1 - number followed by italic variable preserved", () => {
    // 2*x* is interpreted as: 2 followed by italic *x*
    // The asterisk between 2 and x is actually the START of the italic marker
    // Not a multiplication operator. So this is preserved as-is.
    // This is correct behavior - in math notation "2*x*" means "2 times x (italicized)"
    // which is different from "2 × x" (explicit multiplication)
    const result = disambiguateAsterisks("2*x* + 1");
    expect(result).toBe("2*x* + 1");
  });

  test("maskItalicsTokens creates unique placeholders", () => {
    const { text, map } = maskItalicsTokens("*x* + *y* + *z*");
    const keys = Object.keys(map);
    expect(keys.length).toBe(3);
    const uniqueCount = new Set(keys).size;
    expect(uniqueCount).toBe(3);
    keys.forEach(key => {
      expect(key).toMatch(/^IMASK\d+IMASK$/);
    });
  });
});

// =============================================================================
// TEST SUITE 8: Line Break Handling
// =============================================================================

describe("Line Break Handling", () => {
  test("normalizeLineBreaks handles Windows CRLF", () => {
    const result = normalizeLineBreaks("line1\r\nline2");
    expect(result).toBe("line1\nline2");
  });

  test("normalizeLineBreaks handles old Mac CR", () => {
    const result = normalizeLineBreaks("line1\rline2");
    expect(result).toBe("line1\nline2");
  });

  test("removeNewlinesInsideDelimiters handles parentheses", () => {
    const result = removeNewlinesInsideDelimiters("(x +\n6)");
    expect(result).toBe("(x + 6)");
  });

  test("removeNewlinesInsideDelimiters handles braces", () => {
    const result = removeNewlinesInsideDelimiters("{3/\n4}");
    expect(result).toBe("{3/ 4}");
  });

  test("removeNewlinesInsideDelimiters handles nested", () => {
    const result = removeNewlinesInsideDelimiters("((a +\nb) +\nc)");
    expect(result).toBe("((a + b) + c)");
  });

  test("joinBrokenEquationLines joins incomplete lines", () => {
    const result = joinBrokenEquationLines("x +\n5 = 10");
    expect(result).toBe("x + 5 = 10");
  });

  test("joinBrokenEquationLines preserves paragraph breaks", () => {
    const result = joinBrokenEquationLines("para1\n\npara2");
    expect(result).toContain("\n\n");
  });

  test("isIncompleteEquationLine detects trailing operators", () => {
    expect(isIncompleteEquationLine("x +")).toBe(true);
    expect(isIncompleteEquationLine("y -")).toBe(true);
    expect(isIncompleteEquationLine("z =")).toBe(true);
    expect(isIncompleteEquationLine("x + 5")).toBe(false);
  });

  test("startsNewEquation detects new equations", () => {
    expect(startsNewEquation("6x - 15 = 2x + 14")).toBe(true);
    expect(startsNewEquation("Area = length × width")).toBe(true);
    expect(startsNewEquation("+ 5")).toBe(false);
  });
});

// =============================================================================
// TEST SUITE 9: Normalize Equation Block for Extraction
// =============================================================================

describe("normalizeEquationBlockForExtraction", () => {
  test("handles empty input", () => {
    expect(normalizeEquationBlockForExtraction("")).toBe("");
  });

  test("normalizes mixed line breaks", () => {
    const input = "line1\r\nline2\rline3\nline4";
    const result = normalizeEquationBlockForExtraction(input);
    expect(result).not.toContain("\r");
  });

  test("isolates labels before extraction", () => {
    const input = "x + 5 Left Side: y = 10";
    const result = normalizeEquationBlockForExtraction(input);
    expect(result).toContain("\n\nLeft Side:\n");
  });

  test("fixes newlines inside delimiters", () => {
    const input = "(x +\n6)";
    const result = normalizeEquationBlockForExtraction(input);
    expect(result).not.toContain("(x +\n6)");
  });

  test("no token leakage in output", () => {
    const input = "{3/4}*x* + *y*^2^ Right Side: z = 5";
    const result = normalizeEquationBlockForExtraction(input);
    expect(result).not.toContain("IMASK");
    expect(result).not.toContain("MASK");
  });
});

// =============================================================================
// TEST SUITE 10: Canonical formatForMathText Entry Points
// =============================================================================

describe("Canonical formatForMathText Entry Points", () => {
  test("formatForMathText returns string", () => {
    const result = formatForMathText("x + 5 = 10", "test");
    expect(typeof result).toBe("string");
    // Cast to string for comparison since result is branded type
    expect(result as string).toBe("x + 5 = 10");
  });

  test("formatTitleForMathText removes all newlines", () => {
    const result = formatTitleForMathText("Step 1:\nSolve for x", "test");
    expect(result as string).not.toContain("\n");
    expect(result as string).toBe("Step 1: Solve for x");
  });

  test("formatProseForMathText collapses newlines to spaces", () => {
    const result = formatProseForMathText("Line 1\nLine 2\nLine 3", "test");
    expect(result as string).not.toContain("\n");
    expect(result as string).toBe("Line 1 Line 2 Line 3");
  });

  test("formatEquationForMathText applies equation formatting", () => {
    // formatEquationText does NOT call fixUnclosedNotation - that's in formatAIContent
    // It focuses on fraction normalization, label isolation, etc.
    const result = formatEquationForMathText("{3/4}*x* + (1/2)", "test");
    // Should convert parenthetical fraction
    expect(result).toContain("{1/2}");
  });

  test("all canonical entry points strip internal artifacts", () => {
    const inputs = [
      formatForMathText("{3/4}*x* MASK123", "test"),
      formatTitleForMathText("Title IMASK0IMASK", "test"),
      formatProseForMathText("Prose PLACEHOLDER_1", "test"),
      formatEquationForMathText("Eq XXIMAGEPROTECTED0XX", "test"),
    ];

    inputs.forEach(result => {
      expect(result).not.toMatch(/MASK|IMASK|PLACEHOLDER|XXIMAGEPROTECTED/);
    });
  });
});

// =============================================================================
// TEST SUITE 11: Integration Tests (Full Pipeline)
// =============================================================================

describe("Full Pipeline Integration", () => {
  test("complex equation with all features", () => {
    const input = "{3/4}*x*^2^ + (1/2)*y* = *z* Left-hand side: result";
    const result = formatAIContent(input);

    // Should convert parenthetical fraction
    expect(result).toContain("{1/2}");
    // Should preserve italics
    expect(result).toContain("*x*");
    expect(result).toContain("*y*");
    expect(result).toContain("*z*");
    // Superscript should remain (already closed in input)
    expect(result).toContain("^2^");
    // Should normalize label
    expect(result).toContain("Left Side:");
    // Should have no leakage
    expect(result).not.toContain("IMASK");
    expect(result).not.toContain("MASK");
  });

  test("superscript auto-closing in formatAIContent", () => {
    // Test that formatAIContent DOES auto-close superscripts
    const result = formatAIContent("x^2 + y^3 = z");
    expect(result).toContain("^2^");
    expect(result).toContain("^3^");
  });

  test("multi-step equation solution", () => {
    const input = "Start with the equation: 2x + 5 = 15 Subtract 5 from both sides: 2x = 10 Divide by 2: x = 5";
    const result = formatAIContent(input);

    const lineCount = result.split("\n").length;
    expect(lineCount).toBeGreaterThan(1);
    expect(result).not.toContain("⟪STEP⟫");
  });

  test("list items get proper line breaks", () => {
    const input = "Choose the correct answer: A. First option B. Second option C. Third option D. Fourth option";
    const result = formatAIContent(input);

    expect(result).toContain("\n");
    expect(result).not.toContain("LIST_BREAK");
  });

  test("image protection during step processing", () => {
    const input = "[IMAGE: A graph showing the equation](file:///path/image.png) Start with y = mx + b";
    const result = formatAIContent(input);

    expect(result).toContain("[IMAGE:");
    expect(result).toContain("file:///path/image.png");
    expect(result).not.toContain("XXIMAGEPROTECTED");
  });
});

// =============================================================================
// TEST SUITE 12: Variable Highlighting
// =============================================================================

describe("Variable Highlighting", () => {
  test("extractSingleLetterVars finds italic variables", () => {
    const vars = extractSingleLetterVars("*x* + *y* = *z*");
    expect(vars.length).toBe(3);
    expect(vars[0]).toBe("x");
    expect(vars[1]).toBe("y");
    expect(vars[2]).toBe("z");
  });

  test("extractSingleLetterVars returns unique vars in order", () => {
    const vars = extractSingleLetterVars("*x* + *y* + *x* = *z*");
    expect(vars.length).toBe(3);
    expect(vars[0]).toBe("x");
    expect(vars[1]).toBe("y");
    expect(vars[2]).toBe("z");
  });

  test("extractSingleLetterVars skips common words a, i", () => {
    // "a" and "i" are excluded as they're usually articles/pronouns
    const vars = extractSingleLetterVars("*x* + a = i");
    expect(vars.length).toBe(1);
    expect(vars[0]).toBe("x");
  });

  test("buildVarColorMap assigns colors consistently", () => {
    const map = buildVarColorMap("*x* + *y* + *m* + *b*");
    expect(map.get("x")).toBe(VAR_COLORS[0]);
    expect(map.get("y")).toBe(VAR_COLORS[1]);
    expect(map.get("m")).toBe(VAR_COLORS[2]);
    expect(map.get("b")).toBe(VAR_COLORS[3]);
  });

  test("buildVarColorMap cycles colors when more vars than colors", () => {
    const map = buildVarColorMap("*b* *c* *d* *e* *f* *g* *h* *j*");
    // With 4 colors and 8 vars (b, c, d, e, f, g, h, j), should cycle
    expect(map.size).toBe(8);
    // First 4 vars get first 4 colors, next 4 cycle back
    expect(map.get("b")).toBe(VAR_COLORS[0]);
    expect(map.get("c")).toBe(VAR_COLORS[1]);
    expect(map.get("d")).toBe(VAR_COLORS[2]);
    expect(map.get("e")).toBe(VAR_COLORS[3]);
    expect(map.get("f")).toBe(VAR_COLORS[0]); // Cycles back
    expect(map.get("g")).toBe(VAR_COLORS[1]);
    expect(map.get("h")).toBe(VAR_COLORS[2]);
    expect(map.get("j")).toBe(VAR_COLORS[3]);
  });

  test("applyVarColors wraps italic variables with color tags", () => {
    const colorMap = new Map<string, string>([["x", "blue"]]) as Map<string, typeof VAR_COLORS[number]>;
    const result = applyVarColors("*x* + 5 = 10", colorMap);
    expect(result).toContain("[blue:*x*]");
  });

  test("applyVarColors does not double-wrap already colored vars", () => {
    const colorMap = new Map<string, string>([["x", "blue"]]) as Map<string, typeof VAR_COLORS[number]>;
    const input = "[red:*x*] + 5"; // Already has color
    const result = applyVarColors(input, colorMap);
    // Should not create nested color tags
    expect(result).not.toContain("[blue:[red:");
  });

  test("VAR_COLORS has expected colors", () => {
    expect(VAR_COLORS.length).toBe(4);
    expect(VAR_COLORS).toContain("blue");
    expect(VAR_COLORS).toContain("green");
    expect(VAR_COLORS).toContain("orange");
    expect(VAR_COLORS).toContain("purple");
  });
});

// =============================================================================
// TEST SUITE 13: Step Action Inference
// =============================================================================

describe("Step Action Inference", () => {
  test("inferStepAction detects final answer", () => {
    const result = inferStepAction("Therefore, x = 5");
    expect(result.action).toBe("final");
    expect(result.label).toBe("Final answer");
  });

  test("inferStepAction detects distribution", () => {
    const result = inferStepAction("Distribute the 3 across the parentheses");
    expect(result.action).toBe("distribute");
    expect(result.label).toBe("Distribute");
  });

  test("inferStepAction detects combining like terms", () => {
    const result = inferStepAction("Combine like terms on the left side");
    expect(result.action).toBe("combine_like_terms");
    expect(result.label).toBe("Combine like terms");
  });

  test("inferStepAction detects simplification", () => {
    const result = inferStepAction("Simplify the expression");
    expect(result.action).toBe("simplify");
    expect(result.label).toBe("Simplify");
  });

  test("inferStepAction detects add/subtract both sides", () => {
    const result = inferStepAction("Add 5 to both sides");
    expect(result.action).toBe("add_subtract_both_sides");
    expect(result.label).toBe("Add/Subtract both sides");
  });

  test("inferStepAction detects multiply/divide both sides", () => {
    const result = inferStepAction("Divide both sides by 3");
    expect(result.action).toBe("multiply_divide_both_sides");
    expect(result.label).toBe("Multiply/Divide both sides");
  });

  test("inferStepAction detects factoring", () => {
    const result = inferStepAction("Factor the quadratic expression");
    expect(result.action).toBe("factor");
    expect(result.label).toBe("Factor");
  });

  test("inferStepAction detects substitution", () => {
    const result = inferStepAction("Substitute x = 3 into the equation");
    expect(result.action).toBe("substitute");
    expect(result.label).toBe("Substitute");
  });

  test("inferStepAction detects evaluation", () => {
    const result = inferStepAction("Calculate the final value");
    expect(result.action).toBe("evaluate");
    expect(result.label).toBe("Evaluate");
  });

  test("inferStepAction defaults to rewrite for unknown text", () => {
    const result = inferStepAction("Write the equation");
    expect(result.action).toBe("rewrite");
    expect(result.label).toBe("Rewrite");
  });
});

// =============================================================================
// TEST SUITE 14: Both Sides Operation Extraction
// =============================================================================

describe("Both Sides Operation Extraction", () => {
  test("extractBothSidesOp detects add to both sides", () => {
    const result = extractBothSidesOp("Add 11 to both sides");
    expect(result).toBeDefined();
    expect(result!.type).toBe("add");
    expect(result!.value).toBe("11");
  });

  test("extractBothSidesOp detects adding to both sides (gerund)", () => {
    const result = extractBothSidesOp("Adding 5 to both sides");
    expect(result).toBeDefined();
    expect(result!.type).toBe("add");
    expect(result!.value).toBe("5");
  });

  test("extractBothSidesOp detects subtract from both sides", () => {
    const result = extractBothSidesOp("Subtract 3x from both sides");
    expect(result).toBeDefined();
    expect(result!.type).toBe("subtract");
    expect(result!.value).toBe("3x");
  });

  test("extractBothSidesOp detects subtracting from both sides", () => {
    const result = extractBothSidesOp("Subtracting 7 from both sides");
    expect(result).toBeDefined();
    expect(result!.type).toBe("subtract");
    expect(result!.value).toBe("7");
  });

  test("extractBothSidesOp detects multiply both sides by", () => {
    const result = extractBothSidesOp("Multiply both sides by 2");
    expect(result).toBeDefined();
    expect(result!.type).toBe("multiply");
    expect(result!.value).toBe("2");
  });

  test("extractBothSidesOp detects multiplying both sides by", () => {
    const result = extractBothSidesOp("Multiplying both sides by {1/2}");
    expect(result).toBeDefined();
    expect(result!.type).toBe("multiply");
    expect(result!.value).toBe("{1/2}");
  });

  test("extractBothSidesOp detects divide both sides by", () => {
    const result = extractBothSidesOp("Divide both sides by 4");
    expect(result).toBeDefined();
    expect(result!.type).toBe("divide");
    expect(result!.value).toBe("4");
  });

  test("extractBothSidesOp detects dividing both sides by", () => {
    const result = extractBothSidesOp("Dividing both sides by 3");
    expect(result).toBeDefined();
    expect(result!.type).toBe("divide");
    expect(result!.value).toBe("3");
  });

  test("extractBothSidesOp handles each side variant", () => {
    const result = extractBothSidesOp("Add 5 to each side");
    expect(result).toBeDefined();
    expect(result!.type).toBe("add");
    expect(result!.value).toBe("5");
  });

  test("extractBothSidesOp returns undefined for non-matching text", () => {
    const result = extractBothSidesOp("Simplify the expression");
    expect(result).toBeUndefined();
  });

  test("extractBothSidesOp cleans trailing punctuation", () => {
    const result = extractBothSidesOp("Add 10 to both sides.");
    expect(result).toBeDefined();
    expect(result!.value).toBe("10");
  });

  test("extractBothSidesOp handles complex operands", () => {
    const result = extractBothSidesOp("Subtract *x* from both sides");
    expect(result).toBeDefined();
    expect(result!.type).toBe("subtract");
    expect(result!.value).toBe("*x*");
  });
});

// =============================================================================
// TEST SUITE 15: Content Kind Detection
// =============================================================================

describe("Content Kind Detection", () => {
  test("detectContentKind returns prose for empty input", () => {
    expect(detectContentKind("")).toBe("prose");
    expect(detectContentKind(undefined)).toBe("prose");
  });

  test("detectContentKind detects math content with equations", () => {
    expect(detectContentKind("x + 5 = 10")).toBe("math");
    expect(detectContentKind("2x = 14")).toBe("math");
  });

  test("detectContentKind detects math content with fractions", () => {
    expect(detectContentKind("{3/4}")).toBe("math");
    expect(detectContentKind("y = {1/2}x + 3")).toBe("math");
  });

  test("detectContentKind detects math content with color tags", () => {
    expect(detectContentKind("[red:*x*] + 5")).toBe("math");
    expect(detectContentKind("[blue:important]")).toBe("math");
  });

  test("detectContentKind detects math content with superscripts", () => {
    expect(detectContentKind("x^2 + y^2")).toBe("math");
  });

  test("detectContentKind detects list content with A. format", () => {
    expect(detectContentKind("A. First option")).toBe("list");
    expect(detectContentKind("B. Second option")).toBe("list");
  });

  test("detectContentKind detects list content with numbered format", () => {
    expect(detectContentKind("1) First item")).toBe("list");
    expect(detectContentKind("2) Second item")).toBe("list");
  });

  test("detectContentKind detects list content with bullets", () => {
    expect(detectContentKind("- First bullet")).toBe("list");
  });

  test("detectContentKind detects code content", () => {
    expect(detectContentKind("```javascript\nconst x = 5;\n```")).toBe("code");
    expect(detectContentKind("return value;")).toBe("code");
  });

  test("detectContentKind returns prose for plain text", () => {
    expect(detectContentKind("This is a simple explanation.")).toBe("prose");
    expect(detectContentKind("The answer is because of the following reasons.")).toBe("prose");
  });
});

// =============================================================================
// TEST SUITE 16: Format By Kind Routing
// =============================================================================

describe("Format By Kind Routing", () => {
  test("formatByKind returns empty string for empty input", () => {
    expect(formatByKind("", "prose")).toBe("");
    expect(formatByKind("", "math")).toBe("");
  });

  test("formatByKind preserves list structure", () => {
    const input = "A. Option one\nB. Option two";
    const result = formatByKind(input, "list");
    expect(result).toContain("A. Option one");
    expect(result).toContain("B. Option two");
  });

  test("formatByKind collapses excessive newlines in list", () => {
    const input = "A. Option one\n\n\n\nB. Option two";
    const result = formatByKind(input, "list");
    expect(result).not.toMatch(/\n{3,}/);
  });

  test("formatByKind preserves code whitespace", () => {
    const input = "function foo() {\n  return 5;\n}";
    const result = formatByKind(input, "code");
    expect(result).toBe(input);
  });

  test("formatByKind cleans prose whitespace", () => {
    const input = "Line one   \nLine two";
    const result = formatByKind(input, "prose");
    expect(result).not.toContain("   \n");
  });

  test("formatByKind applies math transforms to math content", () => {
    // formatByKind with "math" routes to formatEquationText
    const input = "(3/4) x";
    const result = formatByKind(input, "math");
    // Should convert parenthetical fraction to brace syntax
    expect(result).toContain("{3/4}");
  });
});

// =============================================================================
// TEST SUITE 17: No-Leakage Test (Global)
// =============================================================================

import {
  ALL_GOLDEN_FIXTURES,
  scanForLeakedMarkers,
  INTERNAL_MARKER_PATTERNS,
} from "../__fixtures__/goldenSnapshots";
import { formatSolution } from "../contentFormatter";

describe("No-Leakage Test (Global)", () => {
  test("formatAIContent never leaks internal markers", () => {
    // Test with various problematic inputs that exercise masking logic
    const testInputs = [
      "{3/4}*8 means multiply",
      "*x* + *y* = *z*",
      "Step 1: Solve for x Add 5 to both sides",
      "A. First option B. Second option C. Third option D. Fourth option",
      "[IMAGE: test image](file:///path/to/image.png)",
      "{1/2} × (x + 6) = 10",
      "Left-hand side: 2x + 3 Right-hand side: 7",
    ];

    for (const input of testInputs) {
      const result = formatAIContent(input);
      for (const pattern of INTERNAL_MARKER_PATTERNS) {
        const match = result.match(pattern);
        expect(match).toBeNull();
      }
    }
  });

  test("formatEquationText never leaks internal markers", () => {
    const testInputs = [
      "{3/4}*x* = 6",
      "2*x* + 3*y* = 10",
      "{1/2} × {3/4}",
      "x^2^ + y^2^ = z^2^",
    ];

    for (const input of testInputs) {
      const result = formatEquationText(input);
      for (const pattern of INTERNAL_MARKER_PATTERNS) {
        const match = result.match(pattern);
        expect(match).toBeNull();
      }
    }
  });

  test("formatForMathText never leaks internal markers", () => {
    const testInputs = [
      "Multiply {3/4}*8 to get 6",
      "*x* + 5 = 10",
      "A. Option B. Option",
    ];

    for (const input of testInputs) {
      const result = formatForMathText(input);
      for (const pattern of INTERNAL_MARKER_PATTERNS) {
        const match = result.match(pattern);
        expect(match).toBeNull();
      }
    }
  });

  test("formatSolution never leaks internal markers in any field", () => {
    const testSolution = {
      problem: "Solve {3/4}*x* = 6",
      steps: [
        {
          id: "step-1",
          title: "Multiply both sides by {4/3}",
          equation: "{4/3} × {3/4}*x* = {4/3} × 6",
          summary: "We multiply to isolate *x*",
        },
        {
          id: "step-2",
          title: "Simplify",
          equation: "*x* = 8",
          summary: "The variable is now isolated",
        },
      ],
      finalAnswer: "*x* = 8",
    };

    const result = formatSolution(testSolution);
    const leaks = scanForLeakedMarkers(result);

    expect(leaks.length).toBe(0);
  });
});

// =============================================================================
// TEST SUITE 18: Golden Snapshot Tests
// =============================================================================

describe("Golden Snapshot Tests", () => {
  for (const fixture of ALL_GOLDEN_FIXTURES) {
    describe(`Fixture: ${fixture.name}`, () => {
      test(`${fixture.name} formats without leaking markers`, () => {
        // Format the raw AI output through the solution formatter
        const formattedSolution = formatSolution({
          problem: fixture.rawAIOutput.problem,
          steps: fixture.rawAIOutput.steps.map((step, i) => ({
            id: `step-${i}`,
            title: step.title,
            equation: step.equation,
            summary: step.summary,
            content: step.content,
          })),
          finalAnswer: fixture.rawAIOutput.finalAnswer,
        });

        // Check for leaked markers
        const leaks = scanForLeakedMarkers(formattedSolution);
        expect(leaks.length).toBe(0);
      });

      if (fixture.expectedFormatted.stepEquationsShouldContain) {
        test(`${fixture.name} step equations contain expected content`, () => {
          const formattedSolution = formatSolution({
            problem: fixture.rawAIOutput.problem,
            steps: fixture.rawAIOutput.steps.map((step, i) => ({
              id: `step-${i}`,
              title: step.title,
              equation: step.equation,
              summary: step.summary,
            })),
            finalAnswer: fixture.rawAIOutput.finalAnswer,
          });

          fixture.expectedFormatted.stepEquationsShouldContain!.forEach((expectedItems, stepIndex) => {
            const step = formattedSolution.steps[stepIndex];
            if (step?.equation) {
              for (const item of expectedItems) {
                expect(step.equation).toContain(item);
              }
            }
          });
        });
      }

      if (fixture.expectedFormatted.finalAnswerShouldContain) {
        test(`${fixture.name} final answer contains expected content`, () => {
          const formattedSolution = formatSolution({
            problem: fixture.rawAIOutput.problem,
            steps: fixture.rawAIOutput.steps.map((step, i) => ({
              id: `step-${i}`,
              title: step.title,
              equation: step.equation,
              summary: step.summary,
            })),
            finalAnswer: fixture.rawAIOutput.finalAnswer,
          });

          const finalAnswerText = typeof formattedSolution.finalAnswer === "string"
            ? formattedSolution.finalAnswer
            : formattedSolution.finalAnswer.parts.join(" ");

          for (const item of fixture.expectedFormatted.finalAnswerShouldContain!) {
            expect(finalAnswerText).toContain(item);
          }
        });
      }

      if (fixture.expectedFormatted.finalAnswerShouldNotContain) {
        test(`${fixture.name} final answer does not contain forbidden content`, () => {
          const formattedSolution = formatSolution({
            problem: fixture.rawAIOutput.problem,
            steps: fixture.rawAIOutput.steps.map((step, i) => ({
              id: `step-${i}`,
              title: step.title,
              equation: step.equation,
              summary: step.summary,
            })),
            finalAnswer: fixture.rawAIOutput.finalAnswer,
          });

          const finalAnswerText = typeof formattedSolution.finalAnswer === "string"
            ? formattedSolution.finalAnswer
            : formattedSolution.finalAnswer.parts.join(" ");

          for (const item of fixture.expectedFormatted.finalAnswerShouldNotContain!) {
            expect(finalAnswerText).not.toContain(item);
          }
        });
      }
    });
  }
});

// =============================================================================
// Run Tests
// =============================================================================

function runTests(): void {
  console.log("\n🧪 Running Content Formatter Tests\n");
  console.log("=".repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suites) {
    console.log(`\n📦 ${suite.name}`);
    console.log("-".repeat(40));

    for (const t of suite.tests) {
      if (t.passed) {
        console.log(`  ✅ ${t.name}`);
      } else {
        console.log(`  ❌ ${t.name}`);
        console.log(`     Error: ${t.error}`);
      }
    }

    console.log(`   Summary: ${suite.passed} passed, ${suite.failed} failed`);
    totalPassed += suite.passed;
    totalFailed += suite.failed;
  }

  console.log("\n" + "=".repeat(60));
  console.log(`\n📊 Total: ${totalPassed} passed, ${totalFailed} failed\n`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
runTests();
