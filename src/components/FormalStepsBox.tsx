import React, { useState, useEffect } from "react";
import { View, Text, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MathText } from "./MathText";
import { SolutionStep } from "../types/homework";
import {
  responsive,
  responsiveSpacing,
  responsiveTypography,
  isPortrait,
} from "../utils/responsive";
import { formatEquationText } from "../utils/contentFormatter";

interface FormalStepsBoxProps {
  steps: SolutionStep[];
}

/**
 * Extracts ALL equations from a step's equation field, preserving the full work.
 * For multi-step algebra, we want to show each transformation step.
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

  const equations: string[] = [];
  const lines = equationText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  for (const line of lines) {
    // Skip lines that are clearly explanatory text
    const lowerLine = line.toLowerCase();
    if (lowerLine.endsWith(":") ||
        lowerLine.startsWith("where") ||
        lowerLine.startsWith("since") ||
        lowerLine.startsWith("because") ||
        lowerLine.startsWith("note") ||
        lowerLine.startsWith("this") ||
        lowerLine.startsWith("add ") ||
        lowerLine.startsWith("subtract") ||
        lowerLine.startsWith("multiply") ||
        lowerLine.startsWith("divide") ||
        lowerLine.startsWith("distribute") ||
        lowerLine.startsWith("combine") ||
        lowerLine.startsWith("simplify") ||
        lowerLine.startsWith("solve") ||
        lowerLine.startsWith("we ") ||
        lowerLine.startsWith("the ") ||
        lowerLine.startsWith("let ") ||
        lowerLine.startsWith("original")) {
      continue;
    }

    // Check if line contains = and looks like math
    if (line.includes("=")) {
      // Make sure it has math-like content (numbers, variables, operators)
      if (/[\d{}*xy]/.test(line)) {
        // Clean up the line
        let cleanLine = line;

        // Remove [red:] tags but keep content
        cleanLine = cleanLine.replace(/\[red:([^\]]+)\]/g, "$1");
        // Remove [blue:] tags but keep content
        cleanLine = cleanLine.replace(/\[blue:([^\]]+)\]/g, "$1");
        // Remove arrows
        cleanLine = cleanLine.replace(/→/g, "").trim();

        // CRITICAL: Ensure the equation has BOTH sides of the equals sign
        // Skip lines that start with "=" (incomplete equations)
        if (cleanLine.startsWith("=")) {
          continue;
        }

        // Skip lines that end with "=" (incomplete equations)
        if (cleanLine.endsWith("=")) {
          continue;
        }

        // Validate that there's content on both sides of =
        const eqIdx = cleanLine.indexOf("=");
        if (eqIdx > 0 && eqIdx < cleanLine.length - 1) {
          const leftSide = cleanLine.substring(0, eqIdx).trim();
          const rightSide = cleanLine.substring(eqIdx + 1).trim();

          // Both sides must have content
          if (leftSide.length > 0 && rightSide.length > 0) {
            // Additional validation: right side should have actual mathematical content
            // Skip if right side is just whitespace or incomplete
            if (/[\da-zA-Z]/.test(rightSide)) {
              equations.push(cleanLine);
            }
          }
        }
      }
    }
  }

  return equations;
}

/**
 * Extracts the final/result equation from a step's equation field.
 * Takes a simple approach: find the [red:] tagged answer or the last equation line.
 */
function extractEquation(equationText: string | undefined): string | null {
  if (!equationText) return null;

  // CRITICAL: Skip content that contains image markers - these are not equations
  // [IMAGE NEEDED: ...] and [IMAGE: ...] markers should not be processed as math
  // Also check for the processed form [IMAGE: description](url)
  const hasImageMarker = equationText.includes("[IMAGE NEEDED:") ||
                         equationText.includes("[IMAGE:") ||
                         /\[IMAGE:[^\]]*\]\([^)]+\)/.test(equationText);

  if (hasImageMarker) {
    // Check if there's actual equation content AFTER the image marker
    // Handle both [IMAGE NEEDED: ...] and [IMAGE: ...](url) forms
    let afterImage = "";

    // Try to find content after [IMAGE: ...](url) form first
    const processedImageMatch = equationText.match(/\[IMAGE:[^\]]*\]\([^)]+\)/);
    if (processedImageMatch) {
      const endIndex = equationText.indexOf(processedImageMatch[0]) + processedImageMatch[0].length;
      afterImage = equationText.substring(endIndex).trim();
    } else {
      // Fall back to [IMAGE NEEDED: ...] form
      const imageEndIndex = equationText.lastIndexOf("]");
      if (imageEndIndex !== -1 && imageEndIndex < equationText.length - 1) {
        afterImage = equationText.substring(imageEndIndex + 1).trim();
      }
    }

    if (afterImage && afterImage.includes("=")) {
      return extractEquation(afterImage);
    }
    return null; // Skip entirely if it's just an image marker
  }

  // Priority 1: Look for [red:...] highlighted final answer
  const redMatch = equationText.match(/\[red:([^\]]+)\]/);
  if (redMatch) {
    const redContent = redMatch[1].trim();
    if (redContent.includes("=")) {
      // The red tag contains a full equation - use it directly
      return redContent;
    }
    // The red tag contains just the result value (not a full equation)
    // Look for pattern: variable = value → [red:result] or variable = value [red:result]
    // We want to extract "variable = redContent" as the clean equation
    // Find the equals sign that precedes the red tag
    const beforeRed = equationText.substring(0, equationText.indexOf("[red:"));
    const lastEquals = beforeRed.lastIndexOf("=");
    if (lastEquals !== -1) {
      // Find the variable name before the equals sign
      // Work backwards to find the start of the expression
      let startIndex = lastEquals - 1;
      while (startIndex > 0 && /[\s]/.test(beforeRed[startIndex])) {
        startIndex--;
      }
      // Now find the start of the variable/expression
      while (startIndex > 0 && /[a-zA-Z_*{}\d\s]/.test(beforeRed[startIndex - 1])) {
        startIndex--;
      }
      const variablePart = beforeRed.substring(startIndex, lastEquals).trim();
      if (variablePart) {
        // Return clean equation: variable = result from red tag
        return `${variablePart} = ${redContent}`;
      }
    }
  }

  // Priority 2: Find the LAST line that contains "=" and looks like an equation
  // Split by newlines and work backwards
  const lines = equationText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  for (let i = lines.length - 1; i >= 0; i--) {
    let line = lines[i];

    // Skip lines that are clearly explanatory text
    const lowerLine = line.toLowerCase();
    if (lowerLine.endsWith(":") ||
        lowerLine.startsWith("where") ||
        lowerLine.startsWith("since") ||
        lowerLine.startsWith("because") ||
        lowerLine.startsWith("note") ||
        lowerLine.startsWith("this") ||
        lowerLine.startsWith("add ") ||
        lowerLine.startsWith("subtract") ||
        lowerLine.startsWith("multiply") ||
        lowerLine.startsWith("divide") ||
        lowerLine.startsWith("distribute") ||
        lowerLine.startsWith("combine") ||
        lowerLine.startsWith("simplify") ||
        lowerLine.startsWith("solve") ||
        lowerLine.startsWith("we ") ||
        lowerLine.startsWith("the ") ||
        lowerLine.startsWith("let ")) {
      continue;
    }

    // Check if line contains = and looks like math (not just text with = in it)
    if (line.includes("=")) {
      // Make sure it has math-like content (numbers, variables, operators)
      if (/[\d{}*xy]/.test(line)) {
        // CRITICAL: Skip lines that start with "=" (incomplete equations missing left side)
        if (line.trim().startsWith("=")) {
          continue;
        }

        // CRITICAL: Skip lines that end with "=" (incomplete equations missing right side)
        if (line.trim().endsWith("=")) {
          continue;
        }

        // CRITICAL: If the line has a [red:] tag, extract clean equation
        // Pattern: variable = ... → [red:result] or variable = ... [red:result]
        const redTagMatch = line.match(/\[red:([^\]]+)\]/);
        if (redTagMatch) {
          const redResult = redTagMatch[1].trim();
          // Find the part before the red tag
          const beforeRed = line.substring(0, line.indexOf("[red:")).trim();
          // Remove trailing arrow if present
          const cleanBeforeRed = beforeRed.replace(/→\s*$/, "").trim();
          // Get the variable and equals sign
          const equalsIndex = cleanBeforeRed.lastIndexOf("=");
          if (equalsIndex !== -1) {
            const variablePart = cleanBeforeRed.substring(0, equalsIndex).trim();
            if (variablePart) {
              return `${variablePart} = ${redResult}`;
            }
          }
        }

        // Validate both sides exist
        const eqIdx = line.indexOf("=");
        if (eqIdx > 0) {
          const leftSide = line.substring(0, eqIdx).trim();
          const rightSide = line.substring(eqIdx + 1).trim();
          // Both sides must have content with actual mathematical values
          if (leftSide.length > 0 && rightSide.length > 0 && /[\da-zA-Z]/.test(rightSide)) {
            return line;
          }
        }
      }
    }
  }

  return null;
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
  if (forPortrait) {
    const hasMultipleEquals = right.includes("=");
    const isTooLong = right.length > 25 || left.length > 15;
    const hasComplexPatterns = equation.includes("√") || equation.includes("opposite") || equation.includes("adjacent");

    if (hasMultipleEquals || isTooLong || hasComplexPatterns) {
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

  // Extract ALL equations from each step to show complete work
  // This enables "show your work" style display with every algebraic transformation
  // We'll number them sequentially (1, 2, 3...) regardless of AI step boundaries
  const rawEquations: { equation: string; left: string; right: string; isSingleLine: boolean }[] = [];
  const seenEquations = new Set<string>(); // Track seen equations to prevent duplicates

  steps.forEach((step, index) => {
    // Prefer rawEquation which preserves newlines, fall back to equation/content
    const rawText = step.rawEquation || step.equation || step.content;

    // Extract ALL equations from this step (for showing complete work)
    const allEqs = extractAllEquations(rawText);
    console.log(`[FormalStepsBox] Step ${index + 1} found ${allEqs.length} equations:`, allEqs);

    if (allEqs.length > 0) {
      // Add all equations from this step
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

        const split = splitEquation(finalCleaned, isPortraitMode);

        if (split) {
          rawEquations.push({
            equation: finalCleaned,
            left: split.left,
            right: split.right,
            isSingleLine: false,
          });
        } else if (finalCleaned.includes("=")) {
          rawEquations.push({
            equation: finalCleaned,
            left: "",
            right: "",
            isSingleLine: true,
          });
        }
      });
    } else {
      // Fall back to extracting just the final equation if extractAllEquations found nothing
      const extracted = extractEquation(rawText);
      console.log(`[FormalStepsBox] Step ${index + 1} fallback extracted:`, extracted);
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
        if (seenEquations.has(normalizedEq)) {
          return;
        }
        seenEquations.add(normalizedEq);

        const split = splitEquation(finalCleaned, isPortraitMode);

        if (split) {
          rawEquations.push({
            equation: finalCleaned,
            left: split.left,
            right: split.right,
            isSingleLine: false,
          });
        } else if (finalCleaned.includes("=")) {
          rawEquations.push({
            equation: finalCleaned,
            left: "",
            right: "",
            isSingleLine: true,
          });
        }
      }
    }
  });

  // Now add sequential step numbers (1, 2, 3, 4...)
  const equations = rawEquations.map((eq, index) => ({
    ...eq,
    stepNum: index + 1,
  }));

  // Don't render if we couldn't extract any equations
  if (equations.length === 0) {
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
        {equations.map((eq, index) => (
          <View
            key={index}
            style={{
              flexDirection: "row",
              alignItems: eq.isSingleLine ? "flex-start" : "center",
              marginBottom: index < equations.length - 1 ? equationGap : 0,
              paddingVertical: equationPaddingV,
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
                marginTop: eq.isSingleLine ? 2 : 0,
              }}
            >
              <Text style={{ fontSize: stepNumberFontSize, fontWeight: "700", color: "#ffffff" }}>
                {eq.stepNum}
              </Text>
            </View>

            {eq.isSingleLine ? (
              /* Single line equation - render the full equation without split */
              <View style={{ flex: 1 }}>
                <MathText size={mathSize}>{eq.equation}</MathText>
              </View>
            ) : (
              /* Split equation with aligned equals sign */
              <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-start" }}>
                {/* Left side of equation */}
                <View style={{ flex: 1, alignItems: "flex-end", paddingRight: equalsPaddingH }}>
                  <MathText size={mathSize}>{eq.left}</MathText>
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

                {/* Right side of equation */}
                <View style={{ flex: 1, alignItems: "flex-start", paddingLeft: equalsPaddingH }}>
                  <MathText size={mathSize}>{eq.right}</MathText>
                </View>
              </View>
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
