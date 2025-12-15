import React from "react";
import { View, Text, ScrollView } from "react-native";
import { Image } from "expo-image";
import { typography, colors } from "../utils/designSystem";

interface FractionProps {
  numerator: string;
  denominator: string;
  size?: "small" | "medium" | "large";
  textColor?: string;
  highlighted?: boolean;
}

// Helper function to process subscript and superscript notation
// Extracted to be used by both Fraction and MathText components
function processScriptNotation(text: string): Array<{ text: string; type: 'normal' | 'subscript' | 'superscript' }> {
  const result: Array<{ text: string; type: 'normal' | 'subscript' | 'superscript' }> = [];
  let i = 0;
  let currentText = "";

  const subscriptMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  };

  const superscriptMap: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻',
  };

  while (i < text.length) {
    // Check for subscript _text_
    if (text[i] === '_' && i + 1 < text.length) {
      const nextUnderscore = text.indexOf('_', i + 1);
      if (nextUnderscore !== -1 && nextUnderscore > i + 1) {
        // This is a subscript pattern
        if (currentText) {
          result.push({ text: currentText, type: 'normal' });
          currentText = "";
        }

        const subscriptText = text.substring(i + 1, nextUnderscore);
        const convertedText = subscriptText.split('').map(char => subscriptMap[char] || char).join('');
        result.push({ text: convertedText, type: 'subscript' });

        i = nextUnderscore + 1;
        continue;
      }
    }

    // Check for superscript ^text^
    if (text[i] === '^' && i + 1 < text.length) {
      const nextCaret = text.indexOf('^', i + 1);
      if (nextCaret !== -1 && nextCaret > i + 1) {
        // This is a superscript pattern
        if (currentText) {
          result.push({ text: currentText, type: 'normal' });
          currentText = "";
        }

        const superscriptText = text.substring(i + 1, nextCaret);
        const convertedText = superscriptText.split('').map(char => superscriptMap[char] || char).join('');
        result.push({ text: convertedText, type: 'superscript' });

        i = nextCaret + 1;
        continue;
      }
    }

    currentText += text[i];
    i++;
  }

  if (currentText) {
    result.push({ text: currentText, type: 'normal' });
  }

  return result;
}

export function Fraction({ numerator, denominator, size = "medium", textColor = colors.textPrimary, highlighted = false }: FractionProps) {
  // Get the base font size from MathText's size map
  const baseSizeMap = {
    small: typography.mathSmall.fontSize,
    medium: typography.mathMedium.fontSize,
    large: typography.mathLarge.fontSize,
  };

  // Fractions should be 70% of the base font size to appear proportional
  const baseFontSize = baseSizeMap[size];
  const fontSize = baseFontSize * 0.7; // 70% of base text size
  const padding = fontSize * 0.25; // Proportional padding

  // Helper to process script notation (subscripts/superscripts) and italics
  const processNotation = (text: string) => {
    const parts: React.ReactNode[] = [];
    let currentText = text;
    let partIndex = 0;

    // First, handle italics with *text*
    const italicRegex = /\*([^*]+)\*/g;
    let lastIndex = 0;
    let match;

    while ((match = italicRegex.exec(text)) !== null) {
      // Add text before italic
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index);
        parts.push(
          <Text key={`before-${partIndex++}`} style={{ fontStyle: "normal" }}>
            {beforeText}
          </Text>
        );
      }

      // Add italic text with subscript/superscript handling
      const italicContent = match[1];
      const scriptParts = processScriptNotation(italicContent);

      parts.push(
        <Text key={`italic-${partIndex++}`} style={{ fontStyle: "italic" }}>
          {scriptParts.map((scriptPart, scriptIdx) => {
            if (scriptPart.type === 'subscript') {
              return (
                <Text
                  key={scriptIdx}
                  style={{
                    fontSize: fontSize * 0.7,
                    lineHeight: fontSize * 1.0,
                  }}
                >
                  {scriptPart.text}
                </Text>
              );
            }
            if (scriptPart.type === 'superscript') {
              return (
                <Text
                  key={scriptIdx}
                  style={{
                    fontSize: fontSize * 0.7,
                    lineHeight: fontSize * 0.8,
                  }}
                >
                  {scriptPart.text}
                </Text>
              );
            }
            return <Text key={scriptIdx}>{scriptPart.text}</Text>;
          })}
        </Text>
      );

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last italic
    if (lastIndex < text.length) {
      const remainingText = text.substring(lastIndex);
      const scriptParts = processScriptNotation(remainingText);

      parts.push(
        <Text key={`remaining-${partIndex++}`} style={{ fontStyle: "normal" }}>
          {scriptParts.map((scriptPart, scriptIdx) => {
            if (scriptPart.type === 'subscript') {
              return (
                <Text
                  key={scriptIdx}
                  style={{
                    fontSize: fontSize * 0.7,
                    lineHeight: fontSize * 1.0,
                  }}
                >
                  {scriptPart.text}
                </Text>
              );
            }
            if (scriptPart.type === 'superscript') {
              return (
                <Text
                  key={scriptIdx}
                  style={{
                    fontSize: fontSize * 0.7,
                    lineHeight: fontSize * 0.8,
                  }}
                >
                  {scriptPart.text}
                </Text>
              );
            }
            return <Text key={scriptIdx}>{scriptPart.text}</Text>;
          })}
        </Text>
      );
    }

    // If no italics were found, just process for subscripts/superscripts
    if (parts.length === 0) {
      const scriptParts = processScriptNotation(text);
      return (
        <Text style={{ fontStyle: "normal" }}>
          {scriptParts.map((scriptPart, scriptIdx) => {
            if (scriptPart.type === 'subscript') {
              return (
                <Text
                  key={scriptIdx}
                  style={{
                    fontSize: fontSize * 0.7,
                    lineHeight: fontSize * 1.0,
                  }}
                >
                  {scriptPart.text}
                </Text>
              );
            }
            if (scriptPart.type === 'superscript') {
              return (
                <Text
                  key={scriptIdx}
                  style={{
                    fontSize: fontSize * 0.7,
                    lineHeight: fontSize * 0.8,
                  }}
                >
                  {scriptPart.text}
                </Text>
              );
            }
            return <Text key={scriptIdx}>{scriptPart.text}</Text>;
          })}
        </Text>
      );
    }

    return <>{parts}</>;
  };

  return (
    <View
      className="items-center justify-center mx-1"
      style={{
        paddingHorizontal: padding,
        paddingVertical: 2,
        backgroundColor: highlighted ? "rgba(99, 102, 241, 0.1)" : "transparent",
        borderRadius: 8,
      }}
    >
      <Text
        style={{
          fontSize,
          lineHeight: fontSize * 1.1,
          color: textColor,
          fontWeight: "600",
        }}
      >
        {processNotation(numerator)}
      </Text>
      <View
        style={{
          width: Math.max(numerator.length, denominator.length) * fontSize * 0.6 + 4,
          height: 1.5,
          marginVertical: 1,
          backgroundColor: textColor,
        }}
      />
      <Text
        style={{
          fontSize,
          lineHeight: fontSize * 1.1,
          color: textColor,
          fontWeight: "600",
        }}
      >
        {processNotation(denominator)}
      </Text>
    </View>
  );
}

interface MathTextProps {
  children: string;
  className?: string;
  size?: "small" | "medium" | "large";
  isOnGreenBackground?: boolean; // Flag to indicate if text is on green background (like final answer card)
  /**
   * Mode for content rendering:
   * - "equation": Allows multiline splitting for step-by-step math (default)
   * - "prose": Collapses newlines to spaces for paragraph/summary text
   */
  mode?: "equation" | "prose";
  /**
   * Whether to allow multiline rendering by splitting on \n.
   * Default: true for equations, false for prose mode
   */
  multiline?: boolean;
}

// Color mapping for highlighted terms
const highlightColors: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#10b981",
  purple: "#a855f7",
  orange: "#f97316",
  pink: "#ec4899",
  yellow: "#eab308",
  teal: "#14b8a6",
  indigo: "#6366f1",
};

/**
 * Parses text and renders mathematical notation properly
 * Supports:
 * - Fractions: {numerator/denominator}
 * - Exponents/Superscripts: x^2 or Ca^2+^ (rendered as superscript)
 * - Subscripts: H_2_O or Fe_2_O_3_ (rendered as subscript)
 * - Color highlighting: [red:text], [blue:text], [green:text], etc.
 * - Italic variables: *x*, *d*, *a*, etc. (for variables in explanatory text)
 * - Underline: _text_ (only when spaces around text)
 */

export function MathText({ children, className = "", size = "medium", isOnGreenBackground = false, mode = "equation", multiline }: MathTextProps) {
  const sizeMap = {
    small: typography.mathSmall.fontSize,
    medium: typography.mathMedium.fontSize,
    large: typography.mathLarge.fontSize,
  };

  const fontSize = sizeMap[size];

  // CRITICAL: Define consistent base styles to prevent font size variations
  // ALL text must use these EXACT values to ensure visual consistency
  const baseTextStyle = {
    fontSize: fontSize,
    lineHeight: fontSize * 1.5,
    fontWeight: "600" as const,
  };

  // Determine multiline behavior: explicit prop overrides mode default
  // Default: equation mode allows multiline, prose mode collapses newlines
  const shouldAllowMultiline = multiline !== undefined ? multiline : mode === "equation";

  // CRITICAL: Apply runtime formatting fixes to handle any content that wasn't properly formatted
  // This catches issues with existing stored content or AI output that bypassed post-processing
  let processedChildren = children;

  // CRITICAL: For prose mode, collapse all newlines to spaces FIRST
  // This prevents summary text from being incorrectly split into multiple lines
  if (mode === "prose") {
    processedChildren = processedChildren
      .replace(/\r\n/g, ' ')    // Windows newlines
      .replace(/\r/g, ' ')       // Old Mac newlines
      .replace(/\n/g, ' ')       // Unix newlines
      .replace(/\u2028/g, ' ')   // Unicode line separator
      .replace(/\u2029/g, ' ')   // Unicode paragraph separator
      .replace(/\s+/g, ' ')      // Collapse multiple whitespace
      .trim();
  }

  // CRITICAL: For equation mode, remove newlines INSIDE delimiters (parentheses, braces, brackets)
  // This fixes Issue 1: "(x +\n6)" → "(x + 6)"
  // Must happen BEFORE other processing to ensure expressions stay on single lines
  if (mode === "equation") {
    // Stack-based removal of newlines inside delimiters
    const removeNewlinesInDelimiters = (text: string): string => {
      const result: string[] = [];
      let parenDepth = 0;
      let braceDepth = 0;
      let bracketDepth = 0;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '(') parenDepth++;
        else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
        else if (char === '{') braceDepth++;
        else if (char === '}') braceDepth = Math.max(0, braceDepth - 1);
        else if (char === '[') bracketDepth++;
        else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);

        // If inside any delimiter and encountering a newline, replace with space
        if (char === '\n' && (parenDepth + braceDepth + bracketDepth) > 0) {
          // Skip following whitespace and add single space
          let j = i + 1;
          while (j < text.length && (text[j] === ' ' || text[j] === '\t')) j++;
          const lastChar = result.length > 0 ? result[result.length - 1] : '';
          if (lastChar !== ' ' && lastChar !== '\t') result.push(' ');
          i = j - 1;
        } else {
          result.push(char);
        }
      }
      return result.join('');
    };

    processedChildren = removeNewlinesInDelimiters(processedChildren);

    // SEMANTIC LINE BREAKS: Insert line breaks after "=" signs for better equation display
    // This prevents awkward wrapping in the middle of expressions
    // Only do this if the equation has multiple "=" signs (chained equation)
    // Pattern: "a = b = c" becomes "a =\nb =\nc" for controlled line breaks
    const equalsCount = (processedChildren.match(/=/g) || []).length;
    if (equalsCount >= 2 && !processedChildren.includes('\n')) {
      // Insert newline after each "=" except the last one
      // But only if the content after "=" is substantial (more than just a short result)
      processedChildren = processedChildren.replace(/\s*=\s*(?=[^=]{10,}=)/g, ' =\n');
    }
  }

  // SAFETY: Remove any MASK/PLACEHOLDER tokens that leaked through from broken formatting
  processedChildren = processedChildren.replace(/\b_?MASK\d+_?\b/g, '');
  processedChildren = processedChildren.replace(/PLACEHOLDER[_\d]+/g, '');
  processedChildren = processedChildren.replace(/〔PROTECTED\d+〕/g, '');

  // CRITICAL FIX: Handle malformed fraction syntax where AI uses curly braces for grouping instead of fractions
  // Pattern: {expression}/number → (expression)/number (convert to parentheses grouping)
  // OR: {num}/den → {num/den} (convert to proper fraction syntax)
  // Example: "{*x* - 2}/5" should become "(*x* - 2)/5" (parentheses)
  //       OR "{*x* - 2/5}" (proper fraction with italics inside)
  // Strategy: If {content}/number appears, check if content contains "/" already
  //          - If YES: it's nested fractions, convert outer braces to parens
  //          - If NO: check if it looks like numerator/denominator split
  processedChildren = processedChildren.replace(/\{([^}]+)\}\/(\d+)/g, (match, inside, denominator) => {
    // If inside already has a slash, this is malformed nested fractions - use parentheses
    if (inside.includes('/')) {
      return `(${inside})/${denominator}`;
    }
    // Otherwise, this is likely intended as {numerator/denominator} - merge it
    return `{${inside}/${denominator}}`;
  });

  // CRITICAL FIX: Handle standalone curly braces used for grouping (not fractions)
  // Pattern: {expression} where expression does NOT contain "/" → convert to parentheses
  // This handles cases where AI uses curly braces for algebraic grouping
  // Example: "{*x* - 2}" → "(*x* - 2)"
  // BUT preserve fraction syntax like "{3/4}" (has slash) and avoid breaking multiline content
  processedChildren = processedChildren.replace(/\{([^}/\n]+)\}/g, (match, inside) => {
    // Skip if this looks like a fraction (contains /) or multiline - already handled elsewhere
    if (inside.includes('/') || inside.includes('\n')) {
      return match; // Keep as is - it's a fraction or complex content
    }
    // Convert to parentheses for proper algebraic grouping display
    return `(${inside})`;
  });

  // CRITICAL: Prevent awkward line breaks in mathematical expressions
  // Replace regular spaces with non-breaking spaces in key patterns to keep them together
  // Pattern 1: "Slope: -3/7" or "slope = -3/7" should not break between label and value
  processedChildren = processedChildren.replace(/(Slope|slope|Y-intercept|y-intercept|X-intercept|x-intercept)\s*(:|=)\s+/gi, (match, label, separator) => `${label}${separator}\u00A0`);
  // Pattern 2: "and y-intercept" should not break between "and" and "y-intercept"
  processedChildren = processedChildren.replace(/and\s+(y-intercept|x-intercept|slope)/gi, (match, term) => `and\u00A0${term}`);
  // Pattern 3: "Y-intercept (b)" should not break
  processedChildren = processedChildren.replace(/(Y-intercept|X-intercept|Slope|slope)\s+(\([^)]+\))/gi, (match, label, variable) => `${label}\u00A0${variable}`);
  // Pattern 4: Keep variable equals value together "(*m*) = value"
  processedChildren = processedChildren.replace(/(\([^)]+\))\s+(=\s*[-\d.])/gi, (match, variable, equals) => `${variable}\u00A0${equals}`);
  // Pattern 5: Keep "for problem X:" together
  processedChildren = processedChildren.replace(/for\s+problem\s+(\d+)/gi, (match, num) => `for\u00A0problem\u00A0${num}`);
  // Pattern 6: Keep commas attached to preceding text - prevent "value\n, next" breaks
  processedChildren = processedChildren.replace(/(\S)\s+,/g, '$1,');
  // Pattern 7: Keep common short words together with following word to prevent orphans
  // "The graph" should not break into "The\ngraph"
  processedChildren = processedChildren.replace(/\b(The|A|An|This|That|It)\s+/g, '$1\u00A0');
  // Pattern 8: Keep "for" together with numbers: "for 8 hours" → "for\u00A08 hours"
  processedChildren = processedChildren.replace(/\bfor\s+(\d+)/gi, 'for\u00A0$1');

  // Fix unicode fractions to proper syntax
  const fractionMap: Record<string, string> = {
    '½': '{1/2}',
    '⅓': '{1/3}',
    '⅔': '{2/3}',
    '¼': '{1/4}',
    '¾': '{3/4}',
  };
  Object.entries(fractionMap).forEach(([unicode, syntax]) => {
    processedChildren = processedChildren.replace(new RegExp(unicode, 'g'), syntax);
  });

  // CRITICAL: Normalize fraction syntax - handle whitespace inside fractions
  // Pattern: { optional-whitespace content / content optional-whitespace }
  // Examples: "{ 3 / 4 }" → "{3/4}", "{3 /4}" → "{3/4}"
  processedChildren = processedChildren.replace(/\{\s*([^}\/]+?)\s*\/\s*([^}]+?)\s*\}/g, (match, num, den) => {
    const numerator = num.trim();
    const denominator = den.trim();
    if (numerator && denominator) {
      return `{${numerator}/${denominator}}`;
    }
    return match; // Keep original if malformed
  });

  // CRITICAL FIX for Issue 3: Normalize fractions immediately followed by digits/parens
  // Pattern: {3/4}8 → {3/4} × 8 (insert multiplication symbol)
  // Pattern: {3/4}( → {3/4} × ( (fraction times parenthetical)
  // This ensures the fraction is properly parsed and rendered
  processedChildren = processedChildren.replace(/\}(\d)/g, '} × $1');
  processedChildren = processedChildren.replace(/\}\(/g, '} × (');

  // CRITICAL FIX: Normalize full-width and escaped braces to standard ASCII
  // Some AI outputs use full-width braces ｛｝ or escaped braces \{ \}
  processedChildren = processedChildren
    .replace(/[｛]/g, '{')
    .replace(/[｝]/g, '}')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}');

  // CRITICAL FIX: Auto-close common subscript/superscript patterns that AI outputs incorrectly
  // Fix: "x^2" → "x^2^", "v^2" → "v^2^", "PE_spring" → "PE_spring_"

  // CRITICAL FORMATTING RULES: Ensure consistent use of subscripts for chemical formulas
  // All chemical formulas should use subscripts for numbers, e.g., "H2O" should be "H_2_O"

  // IMPORTANT: Do NOT treat list markers (A. B. C. D.) as subscripts
  // Pattern: "A. ", "B. ", "C. ", "D. " at start of line or after newline should NOT be modified
  // These are list item markers, not subscript patterns

  // CRITICAL: Do NOT apply subscript/superscript auto-formatting if content contains image markers
  // Image URIs contain underscores that must not be modified (e.g., generated_1764943164297.png)
  const hasImageMarker = processedChildren.includes('[IMAGE:');

  if (!hasImageMarker) {
    // Fix superscripts: variable followed by ^ and digits/symbols but no closing ^
    // Pattern: letter/variable followed by ^, then digits or +/-, not already closed
    processedChildren = processedChildren.replace(/([a-zA-Z])\^(\d+|\+|-|[a-zA-Z]+)(?!\^)/g, '$1^$2^');

    // Fix subscripts: variable followed by _ and word, not already closed
    // Pattern: letter/variable followed by _, then word characters, not already closed
    // CRITICAL: Exclude single capital letters (A-D) which are likely list markers
    // CRITICAL: Do NOT match if preceded by / (to avoid matching file:// URIs)
    // Only match lowercase letters or multi-character patterns
    processedChildren = processedChildren.replace(/(?<!\/)([a-z]|[A-Z]{2,})_([a-zA-Z]+\d*)(?!_)/g, '$1_$2_');

    // Fix subscripts for numbers: variable followed by _ and single digit
    // CRITICAL: Only lowercase letters to avoid matching list markers
    // CRITICAL: Do NOT match if preceded by / (to avoid matching file URIs)
    processedChildren = processedChildren.replace(/(?<!\/)([a-z])_(\d)(?!_)/g, '$1_$2_');
  }

  // Remove newlines around arrows - critical for chemistry equations
  processedChildren = processedChildren.replace(/\s*\n\s*(→|⟶|⇒|⟹|➔|➝|➞|➟)\s*\n\s*/g, ' $1 ');
  processedChildren = processedChildren.replace(/\s*\n\s*(→|⟶|⇒|⟹|➔|➝|➞|➟)\s*/g, ' $1 ');
  processedChildren = processedChildren.replace(/\s*(→|⟶|⇒|⟹|➔|➝|➞|➟)\s*\n\s*/g, ' $1 ');
  // Clean up multiple spaces around arrows
  processedChildren = processedChildren.replace(/\s+(→|⟶|⇒|⟹|➔|➝|➞|➟)\s+/g, ' $1 ');

  // Extract text color from className if present
  const textColorMatch = className.match(/text-(white|gray-\d+|indigo-\d+|emerald-\d+)/);
  let defaultTextColor = colors.textPrimary;
  if (textColorMatch) {
    if (textColorMatch[1] === "white") {
      defaultTextColor = "#ffffff";
    } else if (textColorMatch[1].startsWith("gray")) {
      defaultTextColor = colors.textSecondary;
    }
  }

  // Parse the text for special formatting
  const parts: Array<{
    type: "text" | "fraction" | "highlighted" | "arrow" | "fraction-with-text" | "image" | "italic";
    content: string;
    numerator?: string;
    denominator?: string;
    color?: string;
    underline?: boolean;
    italic?: boolean;
    fraction?: any;
    text?: string;
    remainingText?: string;
    imageUrl?: string;
    imageDescription?: string;
  }> = [];
  let currentText = "";
  let i = 0;

  while (i < processedChildren.length) {
    // Handle italic text *variable* (for variables in sentences)
    // Must check BEFORE checking for multiplication to avoid conflicts
    if (processedChildren[i] === "*") {
      const nextAsterisk = processedChildren.indexOf("*", i + 1);
      // Check if it's a valid italic pattern (not too long, max 10 chars for variables with subscripts/superscripts)
      // Look ahead to see if there are subscripts/superscripts after the closing *
      if (nextAsterisk !== -1 && nextAsterisk - i <= 10) {
        if (currentText) {
          parts.push({ type: "text", content: currentText });
          currentText = "";
        }

        // Get the content between asterisks
        let italicText = processedChildren.substring(i + 1, nextAsterisk);
        let nextIndex = nextAsterisk + 1;

        // Check if immediately followed by subscript or superscript markers
        // Look for patterns like *v*_0_ or *F*_net_ or *x*^2^
        while (nextIndex < processedChildren.length) {
          // Check for subscript pattern _text_
          if (processedChildren[nextIndex] === "_") {
            const nextUnderscore = processedChildren.indexOf("_", nextIndex + 1);
            if (nextUnderscore !== -1 && nextUnderscore - nextIndex <= 10) {
              // Include the subscript in the italic text
              italicText += processedChildren.substring(nextIndex, nextUnderscore + 1);
              nextIndex = nextUnderscore + 1;
              continue;
            }
          }
          // Check for superscript pattern ^text^
          if (processedChildren[nextIndex] === "^") {
            const nextCaret = processedChildren.indexOf("^", nextIndex + 1);
            if (nextCaret !== -1 && nextCaret - nextIndex <= 10) {
              // Include the superscript in the italic text
              italicText += processedChildren.substring(nextIndex, nextCaret + 1);
              nextIndex = nextCaret + 1;
              continue;
            }
          }
          // No more subscripts/superscripts, break
          break;
        }

        parts.push({
          type: "italic",
          content: italicText,
        });

        i = nextIndex;
        continue;
      }
    }

    // Handle image markers [IMAGE: description](url)
    if (processedChildren[i] === "[" && processedChildren.substring(i, i + 7) === "[IMAGE:") {
      if (currentText) {
        parts.push({ type: "text", content: currentText });
        currentText = "";
      }

      // Find the closing ]
      const descEndIndex = processedChildren.indexOf("]", i + 7);
      if (descEndIndex !== -1 && processedChildren[descEndIndex + 1] === "(") {
        // Find the URL closing )
        const urlEndIndex = processedChildren.indexOf(")", descEndIndex + 2);
        if (urlEndIndex !== -1) {
          const description = processedChildren.substring(i + 7, descEndIndex).trim();
          let url = processedChildren.substring(descEndIndex + 2, urlEndIndex).trim();

          // CRITICAL FIX: Convert division slashes (U+2215) back to forward slashes in file URLs
          // This handles cases where the URL was corrupted by the contentFormatter's
          // normalizeFractionForms which converts word/word to word∕word for ratio descriptions
          // The file:// protocol uses forward slashes, not division slashes
          if (url.includes("file:")) {
            url = url.replace(/∕/g, "/");
          }

          parts.push({
            type: "image",
            content: "",
            imageUrl: url,
            imageDescription: description
          });

          i = urlEndIndex + 1;
          continue;
        }
      }
    }

    // Handle arrows → as special prominent symbols
    if (processedChildren[i] === "→" || (processedChildren[i] === "-" && processedChildren[i + 1] === ">")) {
      if (currentText) {
        parts.push({ type: "text", content: currentText });
        currentText = "";
      }

      parts.push({ type: "arrow", content: "→" });

      // Skip both characters if it's "->"
      if (processedChildren[i] === "-" && processedChildren[i + 1] === ">") {
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    // Handle fractions {num/den}
    if (processedChildren[i] === "{") {
      if (currentText) {
        parts.push({ type: "text", content: currentText });
        currentText = "";
      }

      const closeIndex = processedChildren.indexOf("}", i);
      if (closeIndex !== -1) {
        const fractionContent = processedChildren.substring(i + 1, closeIndex);
        const slashIndex = fractionContent.indexOf("/");

        if (slashIndex !== -1) {
          // CRITICAL: Trim whitespace from numerator and denominator
          // This handles cases like "{ 3 / 4 }" or "{3 / 4}" from AI output
          let numerator = fractionContent.substring(0, slashIndex).trim();
          let denominator = fractionContent.substring(slashIndex + 1).trim();

          // CRITICAL: Strip color tags from numerator and denominator
          // Pattern: [color:content] → content
          const stripColorTags = (text: string): string => {
            return text.replace(/\[(?:red|blue|green|orange|purple|yellow):([^\]]+)\]/gi, '$1');
          };

          numerator = stripColorTags(numerator);
          denominator = stripColorTags(denominator);

          // Only push as fraction if both parts are non-empty after trimming
          if (numerator && denominator) {
            parts.push({
              type: "fraction",
              content: fractionContent,
              numerator,
              denominator,
            });
          } else {
            // Malformed fraction - treat as text
            currentText += processedChildren.substring(i, closeIndex + 1);
          }
        } else {
          currentText += processedChildren.substring(i, closeIndex + 1);
        }

        i = closeIndex + 1;
      } else {
        currentText += processedChildren[i];
        i++;
      }
    }
    // Handle color highlighting [color:text]
    else if (processedChildren[i] === "[") {
      if (currentText) {
        parts.push({ type: "text", content: currentText });
        currentText = "";
      }

      const closeIndex = processedChildren.indexOf("]", i);
      if (closeIndex !== -1) {
        const highlightContent = processedChildren.substring(i + 1, closeIndex);
        const colonIndex = highlightContent.indexOf(":");

        if (colonIndex !== -1) {
          const colorName = highlightContent.substring(0, colonIndex).trim();
          const text = highlightContent.substring(colonIndex + 1).trim();
          parts.push({
            type: "highlighted",
            content: text,
            color: highlightColors[colorName] || defaultTextColor,
          });
        } else {
          currentText += processedChildren.substring(i, closeIndex + 1);
        }

        i = closeIndex + 1;
      } else {
        currentText += processedChildren[i];
        i++;
      }
    }
    // Handle underline _text_ (ONLY for emphasis with spaces, NOT for subscripts)
    // Subscripts like h_max_ or KE_initial_ should NOT be treated as underline
    // Underline is for emphasized text like " _important_ " with spaces
    else if (processedChildren[i] === "_") {
      const nextUnderscoreIndex = processedChildren.indexOf("_", i + 1);
      if (nextUnderscoreIndex !== -1) {
        // Check if this looks like a subscript pattern (no spaces, attached to variable)
        // Subscript patterns: "h_max_", "KE_initial_", "PE_final_"
        // Underline patterns: " _text_ ", "word _text_ word"

        const beforeChar = i > 0 ? processedChildren[i - 1] : ' ';
        const afterChar = nextUnderscoreIndex < processedChildren.length - 1 ? processedChildren[nextUnderscoreIndex + 1] : ' ';
        const isAttachedBefore = /[a-zA-Z0-9]/.test(beforeChar);
        const isAttachedAfter = /[a-zA-Z0-9]/.test(afterChar);

        // If attached to alphanumeric before (like "h_max_"), treat as subscript, not underline
        if (isAttachedBefore) {
          // This is a subscript pattern - don't treat as underline
          // Let the regular text handler capture it, and it will be handled elsewhere
          currentText += processedChildren[i];
          i++;
          continue;
        }

        // Otherwise, treat as underline (emphasis)
        if (currentText) {
          parts.push({ type: "text", content: currentText });
          currentText = "";
        }

        const underlinedText = processedChildren.substring(i + 1, nextUnderscoreIndex);
        parts.push({
          type: "highlighted",
          content: underlinedText,
          underline: true,
        });

        i = nextUnderscoreIndex + 1;
      } else {
        currentText += processedChildren[i];
        i++;
      }
    } else {
      currentText += processedChildren[i];
      i++;
    }
  }

  // Add any remaining text
  if (currentText) {
    parts.push({ type: "text", content: currentText });
  }

  // Group fractions with immediately following text to prevent line breaks
  // This keeps "{3/4}y" together instead of breaking between fraction and variable
  const groupedParts: typeof parts = [];
  for (let i = 0; i < parts.length; i++) {
    const currentPart = parts[i];
    const nextPart = parts[i + 1];

    // If current is a fraction and next is text starting with a letter/variable
    if (currentPart.type === "fraction" && nextPart?.type === "text") {
      const nextText = nextPart.content.trimStart();
      // Check if next text starts with a variable (letter) AND has no space before it
      // This groups things like "{3/4}y" but NOT "{5/6} and" (which should have space)
      const hasSpaceBefore = nextPart.content !== nextText; // Check if trimStart removed anything

      // Only group if it's a single letter variable directly attached (no space before)
      if (!hasSpaceBefore && nextText && /^[a-zA-Z]$/.test(nextText[0]) &&
          (nextText.length === 1 || /^[a-zA-Z][\^_]/.test(nextText))) {
        // Group them together (e.g., {3/4}y or {1/2}x^2^)
        groupedParts.push({
          type: "fraction-with-text",
          content: "", // Required by type but not used for this type
          fraction: currentPart,
          text: nextText.split(/\s+/)[0], // Take only the first word/variable
          remainingText: nextText.substring(nextText.split(/\s+/)[0].length).trimStart(),
        });

        // Skip the next part since we've consumed it
        i++;

        // If there's remaining text, add it as a separate part
        const remaining = (groupedParts[groupedParts.length - 1] as any).remainingText;
        if (remaining) {
          groupedParts.push({ type: "text", content: remaining });
        }
        continue;
      }
    }

    groupedParts.push(currentPart);
  }

  // CRITICAL: Split content by newlines FIRST, then process each line separately
  // This ensures newlines from the formatter (like equation step breaks) are respected
  // Only do this if multiline is allowed (default for equation mode)
  const lines = processedChildren.split('\n');

  if (shouldAllowMultiline && lines.length > 1) {
    // Multiple lines - render each line separately with line breaks
    return (
      <View style={{ width: "100%" }}>
        {lines.map((line, lineIndex) => {
          if (!line.trim()) {
            // Empty line - render small vertical space
            return <View key={`line-${lineIndex}`} style={{ height: fontSize * 0.5 }} />;
          }

          // Render this line as a MathText without splitting (recursive call with single line)
          return (
            <View key={`line-${lineIndex}`} style={{ marginBottom: lineIndex < lines.length - 1 ? 4 : 0 }}>
              <MathText size={size} isOnGreenBackground={isOnGreenBackground} mode={mode} multiline={false}>
                {line}
              </MathText>
            </View>
          );
        })}
      </View>
    );
  }

  // Single line equation rendering
  // CRITICAL: Detect if content has complex elements (fractions, images, arrows)
  // - If YES: Use View-based flex layout for proper alignment of complex elements
  // - If NO: Use pure Text-based rendering for proper inline text flow
  const hasComplexElements = groupedParts.some(part =>
    part.type === "fraction" ||
    part.type === "fraction-with-text" ||
    part.type === "image" ||
    part.type === "arrow"
  );

  // For simple content (only text and italics), use pure Text rendering
  // This allows proper word wrapping and inline flow
  if (!hasComplexElements) {
    return (
      <Text style={{ ...baseTextStyle, color: defaultTextColor }}>
        {groupedParts.map((part, index) => {
          if (part.type === "italic") {
            const scriptParts = processScriptNotation(part.content);
            return (
              <Text
                key={index}
                style={{
                  fontStyle: "italic",
                }}
              >
                {scriptParts.map((scriptPart, scriptIndex) => {
                  if (scriptPart.type === 'subscript') {
                    return (
                      <Text
                        key={scriptIndex}
                        style={{
                          fontSize: fontSize * 0.7,
                          lineHeight: fontSize * 1.2,
                          fontStyle: "italic",
                        }}
                      >
                        {scriptPart.text}
                      </Text>
                    );
                  }
                  if (scriptPart.type === 'superscript') {
                    return (
                      <Text
                        key={scriptIndex}
                        style={{
                          fontSize: fontSize * 0.7,
                          lineHeight: fontSize * 0.8,
                          fontStyle: "italic",
                        }}
                      >
                        {scriptPart.text}
                      </Text>
                    );
                  }
                  return <Text key={scriptIndex}>{scriptPart.text}</Text>;
                })}
              </Text>
            );
          }

          if (part.type === "highlighted") {
            const scriptParts = processScriptNotation(part.content);
            return (
              <Text
                key={index}
                style={{
                  color: part.color || defaultTextColor,
                  textDecorationLine: part.underline ? "underline" : "none",
                  fontWeight: "bold",
                }}
              >
                {scriptParts.map((scriptPart, scriptIndex) => {
                  if (scriptPart.type === 'subscript') {
                    return (
                      <Text
                        key={scriptIndex}
                        style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 1.2 }}
                      >
                        {scriptPart.text}
                      </Text>
                    );
                  }
                  if (scriptPart.type === 'superscript') {
                    return (
                      <Text
                        key={scriptIndex}
                        style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 0.8 }}
                      >
                        {scriptPart.text}
                      </Text>
                    );
                  }
                  return <Text key={scriptIndex}>{scriptPart.text}</Text>;
                })}
              </Text>
            );
          }

          // Regular text with subscripts/superscripts
          const scriptParts = processScriptNotation(part.content);
          return (
            <Text key={index}>
              {scriptParts.map((scriptPart, scriptIndex) => {
                if (scriptPart.type === 'subscript') {
                  return (
                    <Text
                      key={scriptIndex}
                      style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 1.2 }}
                    >
                      {scriptPart.text}
                    </Text>
                  );
                }
                if (scriptPart.type === 'superscript') {
                  return (
                    <Text
                      key={scriptIndex}
                      style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 0.8 }}
                    >
                      {scriptPart.text}
                    </Text>
                  );
                }
                return <Text key={scriptIndex}>{scriptPart.text}</Text>;
              })}
            </Text>
          );
        })}
      </Text>
    );
  }

  // Helper function to render a single part
  const renderPart = (part: typeof groupedParts[0], index: number): React.ReactNode => {
    // Handle image display
    if (part.type === "image" && part.imageUrl) {
      console.log("=== MathText rendering image ===");
      console.log("Image URL:", part.imageUrl);
      console.log("Image description:", part.imageDescription?.substring(0, 100));
      console.log("===============================");
      return (
        <View key={index} style={{ width: "100%", marginVertical: 12 }}>
          <Image
            source={{ uri: part.imageUrl }}
            style={{
              width: "100%",
              height: 300,
              borderRadius: 12,
              backgroundColor: "#f0f0f0"
            }}
            contentFit="contain"
            onError={(error) => {
              console.error("=== MathText Image Load Error ===");
              console.error("Failed to load image URL:", part.imageUrl);
              console.error("Error:", error);
              console.error("=================================");
            }}
            onLoad={() => {
              console.log("=== MathText Image Loaded Successfully ===");
              console.log("URL:", part.imageUrl);
              console.log("==========================================");
            }}
          />
          {part.imageDescription && (
            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
                textAlign: "center",
                marginTop: 8,
                fontStyle: "italic"
              }}
            >
              {part.imageDescription}
            </Text>
          )}
        </View>
      );
    }

    // Handle grouped fraction-with-text
    if ((part as any).type === "fraction-with-text") {
      const grouped = part as any;
      return (
        <View key={index} style={{ flexDirection: "row", alignItems: "center", flexShrink: 0 }}>
          <Fraction
            numerator={grouped.fraction.numerator}
            denominator={grouped.fraction.denominator}
            size={size}
            textColor={defaultTextColor}
          />
          <Text
            style={{
              ...baseTextStyle,
              color: defaultTextColor,
              marginLeft: 2,
            }}
          >
            {grouped.text}
          </Text>
        </View>
      );
    }

    if (part.type === "arrow") {
      const arrowColor = isOnGreenBackground ? "#ffffff" : "#10b981";
      return (
        <Text
          key={index}
          style={{
            fontSize: fontSize * 1.5,
            fontWeight: "900",
            color: arrowColor,
            lineHeight: fontSize * 1.8,
            marginHorizontal: 8,
          }}
        >
          →
        </Text>
      );
    }

    if (part.type === "italic") {
      const scriptParts = processScriptNotation(part.content);
      return (
        <Text
          key={index}
          style={{
            ...baseTextStyle,
            fontStyle: "italic",
            color: defaultTextColor,
            flexShrink: 1,
          }}
        >
          {scriptParts.map((scriptPart, scriptIndex) => {
            if (scriptPart.type === 'subscript') {
              return (
                <Text
                  key={scriptIndex}
                  style={{
                    fontSize: fontSize * 0.7,
                    lineHeight: fontSize * 1.2,
                    fontStyle: "italic",
                  }}
                >
                  {scriptPart.text}
                </Text>
              );
            }
            if (scriptPart.type === 'superscript') {
              return (
                <Text
                  key={scriptIndex}
                  style={{
                    fontSize: fontSize * 0.7,
                    lineHeight: fontSize * 0.8,
                    fontStyle: "italic",
                  }}
                >
                  {scriptPart.text}
                </Text>
              );
            }
            return <Text key={scriptIndex}>{scriptPart.text}</Text>;
          })}
        </Text>
      );
    }

    if (part.type === "fraction" && part.numerator && part.denominator) {
      return (
        <View key={index} style={{ flexShrink: 0 }}>
          <Fraction numerator={part.numerator} denominator={part.denominator} size={size} textColor={defaultTextColor} />
        </View>
      );
    }

    if (part.type === "highlighted") {
      const fractionMatch = part.content.match(/^\{([^}]+)\/([^}]+)\}$/);

      if (fractionMatch) {
        const numerator = fractionMatch[1].trim();
        const denominator = fractionMatch[2].trim();
        return (
          <Fraction
            key={index}
            numerator={numerator}
            denominator={denominator}
            size={size}
            textColor={part.color || defaultTextColor}
            highlighted={true}
          />
        );
      }

      const highlightedParts: React.ReactNode[] = [];
      let remainingText = part.content;
      let partIndex = 0;

      const parseItalicsAndScripts = (text: string): React.ReactNode[] => {
        const italicParts: React.ReactNode[] = [];
        let italicIndex = 0;
        let lastEnd = 0;

        const italicRegex = /\*([^*]+)\*/g;
        let match;

        while ((match = italicRegex.exec(text)) !== null) {
          if (match.index > lastEnd) {
            const beforeText = text.substring(lastEnd, match.index);
            const scriptParts = processScriptNotation(beforeText);
            italicParts.push(
              <Text key={`before-${italicIndex}`} style={{ fontStyle: "normal" }}>
                {scriptParts.map((sp, si) => {
                  if (sp.type === 'subscript') {
                    return <Text key={si} style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 1.2 }}>{sp.text}</Text>;
                  }
                  if (sp.type === 'superscript') {
                    return <Text key={si} style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 0.8 }}>{sp.text}</Text>;
                  }
                  return <Text key={si}>{sp.text}</Text>;
                })}
              </Text>
            );
          }

          const italicContent = match[1];
          const scriptParts = processScriptNotation(italicContent);

          italicParts.push(
            <Text key={`italic-${italicIndex}`} style={{ fontStyle: "italic" }}>
              {scriptParts.map((sp, si) => {
                if (sp.type === 'subscript') {
                  return <Text key={si} style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 1.2 }}>{sp.text}</Text>;
                }
                if (sp.type === 'superscript') {
                  return <Text key={si} style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 0.8 }}>{sp.text}</Text>;
                }
                return <Text key={si}>{sp.text}</Text>;
              })}
            </Text>
          );

          lastEnd = match.index + match[0].length;
          italicIndex++;
        }

        if (lastEnd < text.length) {
          const remainingText = text.substring(lastEnd);
          const scriptParts = processScriptNotation(remainingText);
          italicParts.push(
            <Text key={`remaining-${italicIndex}`} style={{ fontStyle: "normal" }}>
              {scriptParts.map((sp, si) => {
                if (sp.type === 'subscript') {
                  return <Text key={si} style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 1.2 }}>{sp.text}</Text>;
                }
                if (sp.type === 'superscript') {
                  return <Text key={si} style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 0.8 }}>{sp.text}</Text>;
                }
                return <Text key={si}>{sp.text}</Text>;
              })}
            </Text>
          );
        }

        if (italicParts.length === 0) {
          const scriptParts = processScriptNotation(text);
          return scriptParts.map((sp, si) => {
            if (sp.type === 'subscript') {
              return <Text key={si} style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 1.2 }}>{sp.text}</Text>;
            }
            if (sp.type === 'superscript') {
              return <Text key={si} style={{ fontSize: fontSize * 0.7, lineHeight: fontSize * 0.8 }}>{sp.text}</Text>;
            }
            return <Text key={si}>{sp.text}</Text>;
          });
        }

        return italicParts;
      };

      while (remainingText.length > 0) {
        const fractionIndex = remainingText.indexOf("{");

        if (fractionIndex === -1) {
          highlightedParts.push(
            <Text
              key={`${index}-${partIndex}`}
              className="font-bold"
              style={{
                ...baseTextStyle,
                color: part.color || defaultTextColor,
                textDecorationLine: part.underline ? "underline" : "none",
                flexShrink: 1,
              }}
            >
              {parseItalicsAndScripts(remainingText)}
            </Text>
          );
          break;
        }

        if (fractionIndex > 0) {
          const preText = remainingText.substring(0, fractionIndex);
          highlightedParts.push(
            <Text
              key={`${index}-${partIndex}`}
              className="font-bold"
              style={{
                ...baseTextStyle,
                color: part.color || defaultTextColor,
                textDecorationLine: part.underline ? "underline" : "none",
                flexShrink: 1,
              }}
            >
              {parseItalicsAndScripts(preText)}
            </Text>
          );
          partIndex++;
        }

        const closeBrace = remainingText.indexOf("}", fractionIndex);
        if (closeBrace !== -1) {
          const fractionContent = remainingText.substring(fractionIndex + 1, closeBrace);
          const slashIndex = fractionContent.indexOf("/");

          if (slashIndex !== -1) {
            const numerator = fractionContent.substring(0, slashIndex).trim();
            const denominator = fractionContent.substring(slashIndex + 1).trim();
            highlightedParts.push(
              <Fraction
                key={`${index}-${partIndex}`}
                numerator={numerator}
                denominator={denominator}
                size={size}
                textColor={part.color || defaultTextColor}
                highlighted={true}
              />
            );
            partIndex++;
            remainingText = remainingText.substring(closeBrace + 1);
          } else {
            highlightedParts.push(
              <Text
                key={`${index}-${partIndex}`}
                className="font-bold"
                style={{
                  fontSize,
                  lineHeight: fontSize * 1.4,
                  color: part.color || defaultTextColor,
                  textDecorationLine: part.underline ? "underline" : "none",
                  flexShrink: 1,
                }}
              >
                {remainingText.substring(0, closeBrace + 1)}
              </Text>
            );
            partIndex++;
            remainingText = remainingText.substring(closeBrace + 1);
          }
        } else {
          highlightedParts.push(
            <Text
              key={`${index}-${partIndex}`}
              className="font-bold"
              style={{
                fontSize,
                lineHeight: fontSize * 1.4,
                color: part.color || defaultTextColor,
                textDecorationLine: part.underline ? "underline" : "none",
                flexShrink: 1,
              }}
            >
              {remainingText}
            </Text>
          );
          break;
        }
      }

      return <React.Fragment key={index}>{highlightedParts}</React.Fragment>;
    }

    // Handle subscripts/superscripts in regular text
    const scriptParts = processScriptNotation(part.content);

    return (
      <Text
        key={index}
        style={{
          ...baseTextStyle,
          color: defaultTextColor,
        }}
      >
        {scriptParts.map((scriptPart, scriptIndex) => {
          if (scriptPart.type === 'subscript') {
            return (
              <Text
                key={scriptIndex}
                style={{
                  fontSize: fontSize * 0.7,
                  lineHeight: fontSize * 1.2,
                }}
              >
                {scriptPart.text}
              </Text>
            );
          }
          if (scriptPart.type === 'superscript') {
            return (
              <Text
                key={scriptIndex}
                style={{
                  fontSize: fontSize * 0.7,
                  lineHeight: fontSize * 0.8,
                }}
              >
                {scriptPart.text}
              </Text>
            );
          }
          return <Text key={scriptIndex}>{scriptPart.text}</Text>;
        })}
      </Text>
    );
  };

  // For complex content (fractions, arrows, images), use View-based layout with horizontal scroll
  // CRITICAL: Using flexWrap: 'nowrap' and horizontal scroll prevents mid-expression breaking
  // This keeps "x + 17" together instead of breaking into "x" and "+ 17" on separate lines
  const hasImageContent = groupedParts.some(part => part.type === "image");

  // If there are images, use regular layout (images need full width)
  if (hasImageContent) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
        {groupedParts.map((part, index) => renderPart(part, index))}
      </View>
    );
  }

  // For pure equations (fractions, arrows, text), use horizontal scroll to prevent breaking
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ alignItems: "center", flexGrow: 1 }}
      style={{ flexGrow: 0 }}
      bounces={false}
    >
      <View style={{ flexDirection: "row", flexWrap: "nowrap", alignItems: "center" }}>
        {groupedParts.map((part, index) => renderPart(part, index))}
      </View>
    </ScrollView>
  );
}
