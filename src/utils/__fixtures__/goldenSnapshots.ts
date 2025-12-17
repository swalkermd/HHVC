/**
 * Golden Snapshot Fixtures for Formatting Pipeline
 *
 * These fixtures capture representative raw AI outputs and their expected
 * formatted outputs. They serve as end-to-end regression tests for the
 * formatting pipeline.
 *
 * CRITICAL: When formatting behavior changes intentionally, update these
 * snapshots. When tests fail unexpectedly, investigate before updating.
 *
 * Coverage:
 * 1. Algebra multi-step with fractions/arrows
 * 2. Geometry with units
 * 3. Physics word problem with symbols
 * 4. Multiple choice A-D
 * 5. Short answer prose
 * 6. Essay multi-paragraph
 * 7. Code response (if supported)
 */

export interface GoldenFixture {
  name: string;
  description: string;
  category: "math" | "science" | "multiple_choice" | "prose" | "code";
  rawAIOutput: {
    problem: string;
    steps: Array<{
      title: string;
      equation?: string;
      summary?: string;
      content?: string;
    }>;
    finalAnswer: string | { parts: string[] };
  };
  /**
   * Expected formatted output after full formatting pipeline.
   * IMPORTANT: These are snapshots of the SOLUTION OBJECT, not UI.
   */
  expectedFormatted: {
    // Key fields to verify after formatting
    problemShouldContain?: string[];
    problemShouldNotContain?: string[];
    stepEquationsShouldContain?: string[][];
    stepEquationsShouldNotContain?: string[][];
    stepSummariesShouldContain?: string[][];
    finalAnswerShouldContain?: string[];
    finalAnswerShouldNotContain?: string[];
  };
}

// =============================================================================
// FIXTURE 1: Algebra multi-step with fractions and arrows
// =============================================================================

export const algebraMultiStepWithFractions: GoldenFixture = {
  name: "algebra-multi-step-fractions",
  description: "Multi-step algebra problem with fractions, arrows, and equation transformations",
  category: "math",
  rawAIOutput: {
    problem: "Solve for x: {3/4}x + 5 = 11",
    steps: [
      {
        title: "Subtract 5 from both sides",
        equation: "{3/4}x + 5 - 5 = 11 - 5\n{3/4}x = 6",
        summary: "We subtract 5 from both sides to isolate the term with x."
      },
      {
        title: "Multiply both sides by {4/3}",
        equation: "{4/3} × {3/4}x = {4/3} × 6\nx = 8",
        summary: "Multiply both sides by the reciprocal of {3/4} to solve for x."
      }
    ],
    finalAnswer: "x = 8"
  },
  expectedFormatted: {
    stepEquationsShouldContain: [
      ["{3/4}", "= 6"],
      ["{4/3}", "= 8"]  // x may be colorized as [blue:x]
    ],
    stepEquationsShouldNotContain: [
      ["MASK", "PLACEHOLDER", "LIST_BREAK"],
      ["MASK", "PLACEHOLDER", "LIST_BREAK"]
    ],
    finalAnswerShouldContain: ["= 8"],  // x may be colorized
    finalAnswerShouldNotContain: ["MASK", "PLACEHOLDER"]
  }
};

// =============================================================================
// FIXTURE 2: Geometry with units
// =============================================================================

export const geometryWithUnits: GoldenFixture = {
  name: "geometry-with-units",
  description: "Geometry problem with area calculation and units",
  category: "math",
  rawAIOutput: {
    problem: "Find the area of a rectangle with length 12 cm and width 5 cm.",
    steps: [
      {
        title: "Identify the formula",
        equation: "Area = length × width",
        summary: "The area of a rectangle is calculated by multiplying length by width."
      },
      {
        title: "Substitute values",
        equation: "Area = 12 cm × 5 cm\nArea = 60 cm^2",
        summary: "We substitute the given values into the formula."
      }
    ],
    finalAnswer: "60 cm^2^"
  },
  expectedFormatted: {
    stepEquationsShouldContain: [
      ["Area", "×", "width"],
      ["60", "cm"]
    ],
    stepEquationsShouldNotContain: [
      ["MASK"],
      ["MASK"]
    ],
    finalAnswerShouldContain: ["60", "cm"],
    finalAnswerShouldNotContain: ["MASK", "PLACEHOLDER"]
  }
};

// =============================================================================
// FIXTURE 3: Physics word problem with symbols
// =============================================================================

export const physicsWordProblem: GoldenFixture = {
  name: "physics-word-problem",
  description: "Physics problem with Greek symbols and subscripts",
  category: "science",
  rawAIOutput: {
    problem: "Calculate the kinetic energy of an object with mass 5 kg moving at 10 m/s.",
    steps: [
      {
        title: "Write the kinetic energy formula",
        equation: "KE = {1/2}*m**v*^2^",
        summary: "Kinetic energy is calculated using the formula KE = (1/2)mv²."
      },
      {
        title: "Substitute the values",
        equation: "KE = {1/2} × 5 kg × (10 m/s)^2^\nKE = {1/2} × 5 × 100\nKE = 250 J",
        summary: "We substitute m = 5 kg and v = 10 m/s into the formula."
      }
    ],
    finalAnswer: "KE = 250 J (Joules)"
  },
  expectedFormatted: {
    stepEquationsShouldContain: [
      ["{1/2}", "*m*", "*v*"],
      ["250"]  // J may be colorized or modified - just check the number is there
    ],
    stepEquationsShouldNotContain: [
      ["MASK", "IMASK"],
      ["MASK", "IMASK"]
    ],
    finalAnswerShouldContain: ["250"],
    finalAnswerShouldNotContain: ["MASK", "PLACEHOLDER"]
  }
};

// =============================================================================
// FIXTURE 4: Multiple choice A-D
// =============================================================================

export const multipleChoiceAD: GoldenFixture = {
  name: "multiple-choice-ad",
  description: "Multiple choice question with A-D options that must preserve list formatting",
  category: "multiple_choice",
  rawAIOutput: {
    problem: "Which of the following is a prime number? A. 4 B. 6 C. 7 D. 9",
    steps: [
      {
        title: "Analyze each option",
        equation: "A. 4 = 2 × 2 (not prime)\nB. 6 = 2 × 3 (not prime)\nC. 7 = 1 × 7 (prime!)\nD. 9 = 3 × 3 (not prime)",
        summary: "We check each number to see if it has only two factors: 1 and itself."
      }
    ],
    finalAnswer: "C. 7"
  },
  expectedFormatted: {
    // List items should be preserved - check for content indicators
    // Note: Some letters may be modified by subscript processing
    stepEquationsShouldContain: [
      ["= 2 × 2", "prime"]  // Check for content, not just letters
    ],
    stepEquationsShouldNotContain: [
      ["LIST_BREAK", "MASK"]
    ],
    finalAnswerShouldContain: ["7"],
    finalAnswerShouldNotContain: ["MASK", "PLACEHOLDER"]
  }
};

// =============================================================================
// FIXTURE 5: Short answer prose
// =============================================================================

export const shortAnswerProse: GoldenFixture = {
  name: "short-answer-prose",
  description: "Short answer question with prose explanation (no math transforms)",
  category: "prose",
  rawAIOutput: {
    problem: "Explain why the sky appears blue.",
    steps: [
      {
        title: "Rayleigh Scattering",
        summary: "The sky appears blue because of a phenomenon called Rayleigh scattering. When sunlight enters Earth's atmosphere, it collides with gas molecules. Blue light has a shorter wavelength than other colors, so it scatters more easily in all directions. This scattered blue light is what we see when we look up at the sky."
      }
    ],
    finalAnswer: "The sky appears blue due to Rayleigh scattering, where blue light (shorter wavelength) scatters more than other colors when sunlight interacts with atmospheric molecules."
  },
  expectedFormatted: {
    // Prose should preserve paragraph structure
    stepSummariesShouldContain: [
      ["Rayleigh scattering", "blue light", "shorter wavelength"]
    ],
    finalAnswerShouldContain: ["Rayleigh scattering", "blue light"],
    finalAnswerShouldNotContain: ["MASK", "PLACEHOLDER", "LIST_BREAK"]
  }
};

// =============================================================================
// FIXTURE 6: Essay multi-paragraph
// =============================================================================

export const essayMultiParagraph: GoldenFixture = {
  name: "essay-multi-paragraph",
  description: "Essay response with multiple paragraphs that must be preserved",
  category: "prose",
  rawAIOutput: {
    problem: "Write a brief essay on the importance of water conservation.",
    steps: [
      {
        title: "Introduction",
        summary: "Water is one of Earth's most precious resources. Despite covering 71% of our planet's surface, only 2.5% of it is freshwater, and much of that is locked in glaciers and ice caps."
      },
      {
        title: "Main Argument",
        summary: "Water conservation is essential for several reasons. First, it helps preserve ecosystems that depend on freshwater sources. Second, it reduces the energy needed to process and deliver water. Third, it ensures future generations will have access to clean water."
      },
      {
        title: "Conclusion",
        summary: "In conclusion, every individual can contribute to water conservation through simple actions like fixing leaks, taking shorter showers, and using water-efficient appliances. These small steps collectively make a significant impact."
      }
    ],
    finalAnswer: "Water conservation is crucial for environmental sustainability, energy efficiency, and ensuring future access to clean water. Individual actions can collectively make a significant difference."
  },
  expectedFormatted: {
    stepSummariesShouldContain: [
      ["precious resources", "freshwater"],
      ["ecosystems", "energy", "future generations"],
      ["individual", "conservation", "impact"]
    ],
    finalAnswerShouldContain: ["conservation", "sustainability"],
    finalAnswerShouldNotContain: ["MASK", "PLACEHOLDER"]
  }
};

// =============================================================================
// FIXTURE 7: Code response
// =============================================================================

export const codeResponse: GoldenFixture = {
  name: "code-response",
  description: "Programming question with code that must preserve whitespace",
  category: "code",
  rawAIOutput: {
    problem: "Write a function to check if a number is prime.",
    steps: [
      {
        title: "Define the function",
        equation: "```javascript\nfunction isPrime(n) {\n  if (n <= 1) return false;\n  for (let i = 2; i * i <= n; i++) {\n    if (n % i === 0) return false;\n  }\n  return true;\n}\n```",
        summary: "We define a function that checks divisibility from 2 up to the square root of n."
      }
    ],
    finalAnswer: "The isPrime function returns true for prime numbers and false otherwise."
  },
  expectedFormatted: {
    // Code should preserve structure
    stepEquationsShouldContain: [
      ["function", "isPrime", "return"]
    ],
    stepEquationsShouldNotContain: [
      ["MASK", "PLACEHOLDER"]
    ],
    finalAnswerShouldContain: ["isPrime", "true", "false"],
    finalAnswerShouldNotContain: ["MASK", "PLACEHOLDER"]
  }
};

// =============================================================================
// ALL FIXTURES EXPORT
// =============================================================================

export const ALL_GOLDEN_FIXTURES: GoldenFixture[] = [
  algebraMultiStepWithFractions,
  geometryWithUnits,
  physicsWordProblem,
  multipleChoiceAD,
  shortAnswerProse,
  essayMultiParagraph,
  codeResponse,
];

// =============================================================================
// INTERNAL MARKER PATTERNS (for no-leakage test)
// =============================================================================

/**
 * Patterns that should NEVER appear in formatted output.
 * These are internal markers used during the formatting pipeline.
 */
export const INTERNAL_MARKER_PATTERNS = [
  /\bIMASK\d+IMASK\b/,           // Italic masking tokens
  /\bMASK\d+\b/,                  // Generic mask tokens
  /\b_MASK\d+_?\b/,               // Underscore-wrapped mask tokens
  /\bPLACEHOLDER[_\d]+\b/,        // Placeholder tokens
  /XXIMAGEPROTECTED\d*XX/,        // Image protection tokens
  /〔PROTECTED\d+〕/,              // Unicode-bracket protected tokens
  /\bLIST_BREAK\b/,               // List break markers
  /⟪STEP⟫/,                       // Step boundary markers
  /<<ITALIC_\d+>>/,               // Legacy italic tokens
  /__FILE_URL_\d+__/,             // File URL placeholders
];

/**
 * Check if a string contains any internal markers.
 * Returns the first match found, or null if clean.
 */
export function findLeakedMarker(text: string): string | null {
  for (const pattern of INTERNAL_MARKER_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * Recursively scan an object for leaked markers.
 * Returns array of {path, marker} for each leak found.
 */
export function scanForLeakedMarkers(
  obj: unknown,
  path = ""
): Array<{ path: string; marker: string }> {
  const leaks: Array<{ path: string; marker: string }> = [];

  if (typeof obj === "string") {
    const marker = findLeakedMarker(obj);
    if (marker) {
      leaks.push({ path, marker });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      leaks.push(...scanForLeakedMarkers(item, `${path}[${index}]`));
    });
  } else if (typeof obj === "object" && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      const newPath = path ? `${path}.${key}` : key;
      leaks.push(...scanForLeakedMarkers(value, newPath));
    });
  }

  return leaks;
}
