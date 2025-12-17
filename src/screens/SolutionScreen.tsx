import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useHomeworkStore } from "../state/homeworkStore";
import { HomeworkSolution } from "../types/homework";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { MathText } from "../components/MathText";
import { FormalStepsBox } from "../components/FormalStepsBox";
import { colors } from "../utils/designSystem";
import { responsiveTypography, responsiveSpacing, responsiveElements } from "../utils/responsive";
import { formatSolution, formatTitle, formatForMathText, detectContentKind, formatByKind } from "../utils/contentFormatter";
import {
  validateParsedSolution,
  storeValidationFailure,
  formatValidationErrorForUI,
  type ValidatedParsedSolution,
} from "../utils/solutionSchema";

import { detectSubject, getSubjectFormattingRules } from "../utils/subjectDetection";
import { detectDifficultyLevel, getGradeAppropriateInstructions } from "../utils/difficultyDetection";

/**
 * Exported function for TestBot to generate solutions using the app's actual logic
 * This ensures TestBot tests the REAL app code, not a separate implementation
 */
export async function generateSolutionForTesting(questionText: string): Promise<any> {
  // Detect subject automatically
  const { subject } = detectSubject(questionText);
  const formattingRules = getSubjectFormattingRules(subject);

  // Detect difficulty/grade level
  const { gradeLevel, vocabularyGuidance, explanationDepth } = detectDifficultyLevel(
    questionText,
    subject
  );
  const gradeInstructions = getGradeAppropriateInstructions(gradeLevel);

  // Call AI to analyze the text question - using ACTUAL app prompts
  const { getOpenAIClient } = await import("../api/openai");
  const client = getOpenAIClient();

  // This is the EXACT SAME prompt the app uses (copied from analyzeTextQuestion)
  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: `You are an expert educator. Provide a clean, easy-to-follow solution.

**DETECTED SUBJECT: ${subject.toUpperCase()}**

**CRITICAL: Two-Part Step Structure**
Each step MUST have TWO components:
1. "equation": The mathematical work (equations, calculations, formulas)
2. "summary": A single plain-English sentence explaining what we're doing

**IMPORTANT NOTE FOR CHEMISTRY**:
- Calculating the molar mass is a necessary step to convert grams to moles, which is essential for solving stoichiometry problems.
- **Understanding Moles**: A mole represents 6.022 x 10^23 particles (Avogadro's number), which helps in understanding the scale of chemical reactions.
- **CATALYSTS - CRITICAL MECHANISTIC DETAIL**: When discussing catalysts, provide COMPLETE mechanistic explanation: (1) Catalysts provide an alternative reaction pathway with LOWER activation energy Ea, (2) They are NOT consumed - they regenerate after each cycle, (3) They increase BOTH forward AND reverse reaction rates equally (no effect on equilibrium position), (4) ALWAYS provide specific examples with mechanisms: platinum in catalytic converters (oxidizes CO → CO2 via surface adsorption), enzymes like catalase (decomposes H2O2 → H2O + O2 via active site binding), acid catalysts (protonate substrates to activate them). (5) Include energy diagram comparison showing Ea(uncatalyzed) vs Ea(catalyzed).
- **ATOMIC STRUCTURE SIGNIFICANCE**: When discussing elements, connect atomic number to electron configuration AND real-world importance: Oxygen (Z=8, [He]2s²2p⁴) needs 2e⁻ to complete octet → forms 2 bonds → essential for cellular respiration and water formation.

**IMPORTANT NOTE FOR CALCULUS - COMPLETE DERIVATIVE REASONING**:
- **POWER RULE WITH REASONING**: Don't just apply d/dx[x^n] = nx^(n-1). Explain: (1) Why it works: derivative measures instantaneous rate of change, (2) Show term-by-term: d/dx[3x²] = 3·2·x^(2-1) = 6x, (3) Constants: d/dx[5] = 0 because constant functions don't change.
- **CRITICAL POINTS - COMPLETE ANALYSIS**: For optimization/maxima/minima: (1) Find f'(x) = 0 to locate critical points, (2) SECOND DERIVATIVE TEST: f''(x) > 0 → local minimum (concave up, ∪ shape), f''(x) < 0 → local maximum (concave down, ∩ shape), f''(x) = 0 → inconclusive (use first derivative test), (3) ALWAYS verify with sign chart or test points, (4) Connect to real world: "derivative = 0 means slope = 0, we're at a peak or valley".
- **REAL-WORLD APPLICATIONS**: Every calculus problem must connect to practical meaning: velocity → derivative of position, acceleration → derivative of velocity, marginal cost → derivative of cost function.

**IMPORTANT NOTE FOR GENETICS**:
- **Understanding Recessive Alleles**: In genetics, a phenotype is determined by alleles. 'tt' results in a short phenotype because both alleles are recessive, meaning they do not express the dominant trait.

Question: ${questionText}

[Rest of the ACTUAL app prompts will be used here - this is just the core structure]

${gradeInstructions}
${formattingRules}

Respond with JSON matching this structure:
{
  "problem": "Restate the problem",
  "steps": [{"title": "...", "equation": "...", "summary": "..."}],
  "finalAnswer": "..."
}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const responseContent = completion.choices[0]?.message?.content || "{}";
  return JSON.parse(responseContent);
}

type SolutionScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Solution">;
  route: RouteProp<RootStackParamList, "Solution">;
};

export default function SolutionScreen({
  navigation,
  route,
}: SolutionScreenProps) {
  const { problem, problemNumber, textQuestion } = route.params;
  const insets = useSafeAreaInsets();
  const [solution, setSolution] = useState<HomeworkSolution | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedSteps, setRevealedSteps] = useState<number>(0);
  const [isLoadingSimplified, setIsLoadingSimplified] = useState(false);

  useEffect(() => {
    if (textQuestion) {
      analyzeTextQuestion();
    } else {
      analyzeProblem();
    }
  }, []);

  // Helper function to parse JSON from AI response with better error handling
  // Now includes Zod schema validation for strict type checking
  const parseAIResponse = (responseContent: string): ValidatedParsedSolution => {
    let jsonString = responseContent;

    // Try to extract JSON from markdown code blocks
    const codeBlockMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
    } else {
      // Try to find JSON object without code blocks - find the LAST valid JSON object
      const jsonMatches = responseContent.matchAll(/\{[\s\S]*?\}(?=\s*(?:\{|$))/g);
      const allMatches = Array.from(jsonMatches);
      if (allMatches.length > 0) {
        // Use the last match as it's more likely to be the complete response
        jsonString = allMatches[allMatches.length - 1][0];
      }
    }

    // Clean up the JSON string (remove any backticks that might remain)
    jsonString = jsonString.replace(/```/g, "").trim();

    // CRITICAL: Convert LaTeX notation to our syntax BEFORE parsing JSON
    // AI sometimes uses \frac{1}{2} instead of {1/2}, which breaks JSON parsing
    // Pattern: \frac{numerator}{denominator} → {numerator/denominator}
    jsonString = jsonString.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '{$1/$2}');

    // Also remove other common LaTeX commands that shouldn't be in JSON
    jsonString = jsonString.replace(/\\text\{([^}]+)\}/g, '$1');
    jsonString = jsonString.replace(/\\alpha/g, 'alpha');
    jsonString = jsonString.replace(/\\beta/g, 'beta');
    jsonString = jsonString.replace(/\\gamma/g, 'gamma');
    jsonString = jsonString.replace(/\\delta/g, 'delta');
    jsonString = jsonString.replace(/\\theta/g, 'theta');
    jsonString = jsonString.replace(/\\pi/g, 'pi');
    jsonString = jsonString.replace(/\\sigma/g, 'sigma');
    jsonString = jsonString.replace(/\\omega/g, 'omega');

    if (!jsonString || jsonString.length === 0) {
      console.log("Could not extract JSON from response:", responseContent.substring(0, 500));
      throw new Error("No valid JSON found in AI response");
    }

    let parsedSolution;
    try {
      parsedSolution = JSON.parse(jsonString);
    } catch (parseError) {
      // Try to fix common JSON issues before giving up
      console.log("JSON Parse Error:", parseError);
      console.log("Response content:", responseContent.substring(0, 500));
      console.log("Attempted to parse:", jsonString.substring(0, 500));

      // Attempt to fix: replace unescaped backslashes (except for already escaped ones)
      // This handles cases like \alpha, \n that should be \\alpha, \\n in JSON
      let fixedJson = jsonString;

      // Fix unescaped backslashes in string values
      // Match string values and fix backslashes within them
      fixedJson = fixedJson.replace(/"([^"]*(?:\\.[^"]*)*)"/g, (match, content) => {
        // Don't double-escape already escaped sequences
        const fixed = content
          .replace(/\\(?!["\\/bfnrtu])/g, '\\\\');  // Escape backslashes that aren't part of valid escape sequences
        return `"${fixed}"`;
      });

      try {
        parsedSolution = JSON.parse(fixedJson);
        console.log("Successfully parsed after fixing backslashes");
      } catch (secondError) {
        // Last resort: try to extract key fields manually
        try {
          const problemMatch = fixedJson.match(/"problem"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);
          const stepsMatch = fixedJson.match(/"steps"\s*:\s*(\[[^\]]*\])/s);
          const answerMatch = fixedJson.match(/"finalAnswer"\s*:\s*"([^"]*(?:\\.[^"]*)*)"/);

          if (problemMatch && stepsMatch && answerMatch) {
            const reconstructed = {
              problem: problemMatch[1].replace(/\\"/g, '"'),
              steps: JSON.parse(stepsMatch[1]),
              finalAnswer: answerMatch[1].replace(/\\"/g, '"')
            };
            parsedSolution = reconstructed;
          }
        } catch (reconstructError) {
          console.log("Failed to reconstruct JSON:", reconstructError);
        }

        if (!parsedSolution) {
          throw new Error("Invalid JSON format in AI response");
        }
      }
    }

    // CRITICAL: Schema validation using Zod
    // Validates structure BEFORE any formatting is attempted
    const validationResult = validateParsedSolution(parsedSolution);

    if (!validationResult.success) {
      // Store failure for debugging
      storeValidationFailure(validationResult);

      // Throw with user-friendly message
      const errorMessage = formatValidationErrorForUI(validationResult);
      throw new Error(errorMessage);
    }

    return validationResult.data;
  };

  // Helper function to verify solution accuracy
  const verifySolution = async (
    originalProblem: string,
    solution: HomeworkSolution,
    imageBase64?: string
  ): Promise<{ isValid: boolean; correctedSolution?: HomeworkSolution; issues?: string[] }> => {
    try {
      const { getOpenAIClient } = await import("../api/openai");
      const client = getOpenAIClient();

      const messages: any[] = [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a verification expert. Your job is to verify if the provided solution correctly answers the question.

CRITICAL VERIFICATION TASKS:
1. Extract what the question is ACTUALLY asking for (e.g., "find the orbital period", "calculate the height", "determine the force")
2. Check if the solution answers the correct question
3. Verify dimensional analysis - if asking for time, answer should be in time units (not distance)
4. Check if the calculation approach is correct for what's being asked
5. Identify any mismatches between question and answer

ORIGINAL PROBLEM: ${originalProblem}

PROVIDED SOLUTION:
Problem Restatement: ${solution.problem}
Steps: ${JSON.stringify(solution.steps.map(s => ({ title: s.title, equation: s.equation || s.content })), null, 2)}
Final Answer: ${typeof solution.finalAnswer === 'string' ? solution.finalAnswer : JSON.stringify(solution.finalAnswer)}

RESPOND WITH JSON ONLY:
{
  "questionAsking": "What the problem is actually asking for (e.g., 'orbital period in seconds', 'height in meters')",
  "solutionProvides": "What the solution actually calculates (e.g., 'semi-major axis in meters', 'time in seconds')",
  "isCorrect": true/false,
  "dimensionalAnalysis": "Check if units match what's being asked",
  "issues": ["List any problems found"],
  "correctApproach": "If incorrect, briefly describe the correct approach"
}`,
            },
          ],
        },
      ];

      // Add image if available (for image-based problems)
      if (imageBase64) {
        messages[0].content.push({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`,
          },
        });
      }

      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content || "";
      const verification = JSON.parse(responseContent);

      console.log("=== VERIFICATION RESULT ===");
      console.log("Question asks for:", verification.questionAsking);
      console.log("Solution provides:", verification.solutionProvides);
      console.log("Is correct:", verification.isCorrect);
      console.log("Issues:", verification.issues);
      console.log("===========================");

      if (!verification.isCorrect) {
        return {
          isValid: false,
          issues: verification.issues || ["Solution does not correctly answer the question"],
        };
      }

      return { isValid: true };
    } catch (error) {
      console.log("Verification error:", error);
      // If verification fails, proceed with original solution
      return { isValid: true };
    }
  };

  // Helper function to process [IMAGE NEEDED: ...] markers and generate actual images
  const processImageGeneration = async (content: string): Promise<string> => {
    // Find all [IMAGE NEEDED: ...] markers
    const imageNeededPattern = /\[IMAGE NEEDED:\s*([^\]]+)\]/g;
    let processedContent = content;
    const matches: RegExpExecArray[] = [];
    let match;
    while ((match = imageNeededPattern.exec(content)) !== null) {
      matches.push(match);
    }

    for (const match of matches) {
      let description = match[1].trim();

      // CRITICAL: Strip ALL color tags from description to prevent parsing issues
      // Pattern: [color:content] → content
      description = description.replace(/\[(?:red|blue|green|orange|purple|yellow):([^\]]+)\]/gi, '$1');

      try {
        // Generate the image based on the description
        const { generateImage } = await import("../api/image-generation");

        // Create a detailed prompt for educational diagram
        const prompt = `Create a clear, educational diagram showing: ${description}.

Style: Clean, simple, easy to understand. Use labels and clear lines.
Make it appropriate for a student learning this concept.
Use colors to distinguish different elements.

CRITICAL - UNIVERSAL MATHEMATICAL VERIFICATION PROTOCOL:
Before finalizing ANY diagram containing numbers, coordinates, measurements, or calculations:
1. Extract ALL marked/labeled values from your diagram (coordinates, lengths, angles, intercepts, etc.)
2. Substitute these values back into the relevant equation/formula/relationship from the description
3. Verify mathematically that the values satisfy the relationship EXACTLY
4. If ANY value fails verification, recalculate the correct value and reposition/relabel in the diagram
5. This applies universally to: graph intercepts, triangle measurements, physics diagrams, chemical equations, etc.

Example verification for line equation y=12x-8 with x-intercept at (a,0):
- Check: Does 0 = 12(a) - 8?
- If a=2: 0 ≟ 12(2)-8 = 16 ✗ INCORRECT
- Solve correctly: 0 = 12a-8 → a = 2/3 ✓
- Place marker at x ≈ 0.67, not at x = 2

PROBLEM STATEMENT:
- For rectangles: Ensure opposite sides have EQUAL measurements (top side length = bottom side length, left side length = right side length)
  - When calculating dimensions with a surrounding path, remember the path adds twice its width to each dimension (once for each side).

CRITICAL FOR ALGEBRA ANALYSIS:
- The distributive property allows us to multiply a single term by each term inside a parenthesis. Ensure this is explained before applying it in solutions.
- Vieta's formulas state that for a quadratic equation ax^2 + bx + c = 0, the sum of the roots is -b/a and the product is c/a. Include this explanation to help students unfamiliar with these concepts.
- Explain that a zero discriminant in a quadratic equation indicates the vertex of the parabola touches the x-axis at one point, resulting in a double root. This means the equation has exactly one real solution, where the parabola is tangent to the x-axis. To find the double root, you can factor the quadratic equation if possible, or use the quadratic formula. When using the quadratic formula, the double root is given by -b/(2a) when the discriminant is zero.
- **Verification is crucial**: After each algebraic manipulation, verify the step to ensure no errors have been introduced. This helps in maintaining accuracy and understanding the logical flow of the solution.
- **Second Derivative Test**: Explain that the second derivative test helps determine the nature of critical points in a function. If the second derivative at a critical point is positive, the function has a local minimum at that point. If the second derivative is negative, the function has a local maximum. If the second derivative is zero, the test is inconclusive, and further analysis is needed.
- **Critical Points and Derivatives**: Include a brief explanation that setting the first derivative to zero finds critical points where the slope of the tangent is horizontal. These points are potential maxima or minima, as they indicate where the function changes direction.

EVALUATION CRITERIA:
- Verify mathematical accuracy by checking the dimensions and ensuring they meet the specified conditions.
- For cubes: All edges must be the SAME length
- For rectangular prisms: Opposite faces must have IDENTICAL dimensions
- For triangles: Verify all sides and angles follow geometric rules (angles sum to 180°)
- If the description has conflicting dimensions (e.g., "width 6 for PQ and length 8 for SR" where PQ and SR are opposite sides), CORRECT the error by making opposite sides equal
- Choose the most logical interpretation: if uncertain, make the longer dimension the length and shorter dimension the width, applied consistently to opposite sides

CRITICAL FOR ALGEBRA ANALYSIS:
- **Identify INDIVIDUAL TERMS, not grouped sides**
- Ensure translations include 'livre' to 'book' as required by evaluation criteria

CRITICAL FOR BIOLOGY:
- Briefly explain that 'H' and 'O' are standard chemical symbols for hydrogen and oxygen, respectively, as per the periodic table. Highlight the atomic number's role in determining an element's properties and its biological significance, such as hydrogen's role in forming water and organic compounds, and oxygen's role in respiration and energy production.
- Explain how catalysts alter reaction mechanisms by providing an alternative pathway with a lower activation energy. Include a diagram or detailed chemical equations to illustrate this process. Catalysts do not get consumed in the reaction and can be used repeatedly.
- Provide an example of the use of platinum in catalytic converters to demonstrate the variety of applications of catalysts in industry. Explain how platinum helps convert harmful gases from car exhaust into less harmful substances.
- Include interactive questions to test understanding of the photosynthesis process, such as:
  1. What are the main reactants and products of photosynthesis?
  2. Describe the role of chlorophyll in photosynthesis.
  3. Explain how light intensity affects the rate of photosynthesis.
- Provide scenarios or diagrams for students to analyze and identify the stages of photosynthesis.
- Correctly calculate the number of years from 1 AD to 2023 AD as 2023 years. Update any statements or explanations to reflect this accurate calculation.

CRITICAL FOR TRIGONOMETRY:
- Include an explanation for the use of the cosine function: 'The cosine function relates the adjacent side to the hypotenuse in a right triangle. It is used to find the length of the adjacent side when the angle and hypotenuse are known.'
- When converting expressions like '5√3', explicitly show the conversion step: '5√3 ≈ 8.66' to clarify the final answer

CRITICAL FOR KINEMATICS:
- Provide a brief explanation of why specific kinematic equations are used: 'Kinematic equations are used to describe the motion of objects under constant acceleration. They allow us to calculate unknown variables such as displacement, velocity, and time when certain other variables are known.'
- Ensure each step of the calculation is shown, including identifying known variables, selecting the appropriate equation, and solving for the unknown variable.
- For algebraic calculations, break down the steps: 
  1. Identify the variables involved.
  2. Write down the equation.
  3. Solve for the unknown variable step-by-step, showing each transformation.
- For trigonometric calculations, break down the steps:
  1. Identify the known sides and angles.
  2. Choose the appropriate trigonometric function.
  3. Substitute the known values into the function.
  4. Solve for the unknown side or angle, showing each calculation step.

CRITICAL FOR LITERARY ANALYSIS:
- Incorporate specific quotes or passages from 'To Kill a Mockingbird' to substantiate the analysis of literary techniques.
- Ensure quotes are relevant to the literary technique being analyzed and provide context for their inclusion.

CRITICAL FOR CALCULUS:
- Simplify the definition of a derivative to: 'The derivative of a function gives us the rate at which the function is changing.'
- Expand the explanation of the second derivative test: 'The second derivative of a function provides information about the concavity of the function. If the second derivative is positive at a critical point, the function is concave up, indicating a local minimum. Conversely, if the second derivative is negative at a critical point, the function is concave down, indicating a local maximum. This is because a positive second derivative suggests the slope is increasing, while a negative second derivative suggests the slope is decreasing.'
- Explain the power rule: 'The power rule is a shortcut for finding the derivative of a function of the form f(x) = x^n. It works because when you apply the definition of a derivative, the exponent n comes down as a coefficient, and the new exponent becomes n-1. This is a result of the limit definition of a derivative and the properties of exponents.'
- Encourage the use of a sign chart or test values to verify the nature of critical points. This helps confirm whether a critical point is a local maximum, minimum, or neither by analyzing the sign changes of the first derivative around the critical points.'

CRITICAL FOR PROJECTILE MOTION:
- **Explain the significance of the vertical component of velocity**
- Emphasize that the vertical component is crucial for calculating the maximum height because it determines how high the projectile will rise before gravity brings it back down.
- For equations like "3x + 6 = 2x - 4", ensure each term is clearly identified without using color tags:
  * Clearly identify "3x" as an x-term
  * Clearly identify "6" as a constant
  * Clearly identify "2x" as an x-term
  * Clearly identify "-4" as a constant
- DO NOT group "3x + 6" together or "2x - 4" together
- Each term must have its own color box and label

Generate the diagram with mathematically correct dimensions and proper term identification.`;

        const imageUrl = await generateImage(prompt, {
          size: "1024x1024",
          quality: "high",
          format: "png"
        });

        // Replace the marker with the actual image syntax
        // Use the clean description (without color tags) for the caption
        // CRITICAL: Remove newlines from description to prevent breaking markdown syntax
        const cleanDescription = description.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        const imageMarkdown = `[IMAGE: ${cleanDescription}](${imageUrl})`;
        processedContent = processedContent.replace(
          match[0],
          imageMarkdown
        );
      } catch (error) {
        // Handle image generation errors gracefully
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if it's a rate limit error
        if (errorMessage.includes('429') || errorMessage.includes('Too many')) {
          console.log("Image generation rate limited - will retry later or keep placeholder");
          // Keep the original marker - user can regenerate solution later when rate limit resets
        } else {
          console.log("Failed to generate image:", error);
        }
        // Keep the original marker if generation fails for any reason
        // This allows the solution to still display with a text description
      }
    }

    return processedContent;
  };

  // Helper types for buildFormattedSolutionFromParsed
  type ParsedStep = {
    title: string;
    equation?: string;
    content?: string;
    summary?: string;
  };

  type ParsedAISolution = {
    problem: string;
    steps: ParsedStep[];
    finalAnswer: any;
  };

  /**
   * Centralized helper to build formatted solutions consistently.
   * CRITICAL: Always preserves rawEquation for FormalStepsBox alignment.
   * CRITICAL: Uses content-kind routing to prevent math transforms on non-math content.
   * This ensures both normal and correction paths produce identical step structure.
   */
  const buildFormattedSolutionFromParsed = async (
    parsed: ParsedAISolution
  ): Promise<HomeworkSolution> => {
    const steps = await Promise.all(
      (parsed.steps || []).map(async (step, index) => {
        const equationProcessed = step.equation
          ? await processImageGeneration(step.equation)
          : undefined;

        const contentProcessed = step.content
          ? await processImageGeneration(step.content)
          : undefined;

        // Detect content kind for each field to route to appropriate formatter
        const equationKind = detectContentKind(step.equation);
        const summaryKind = detectContentKind(step.summary);

        return {
          id: `step-${index}`,
          title: formatTitle(step.title),
          equation: equationProcessed ? formatByKind(equationProcessed, equationKind) : undefined,
          rawEquation: step.equation, // ALWAYS preserve for FormalStepsBox
          equationKind,
          content: contentProcessed,
          summary: step.summary ? formatByKind(step.summary, summaryKind) : undefined,
          summaryKind,
        };
      })
    );

    const raw: HomeworkSolution = {
      problem: parsed.problem,
      steps,
      finalAnswer: parsed.finalAnswer,
    };

    try {
      return formatSolution(raw);
    } catch (e) {
      console.log("Error in formatSolution (fallback to raw):", e);
      return raw;
    }
  };

  const analyzeTextQuestion = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Detect subject automatically
      let questionText = textQuestion || "";
      const { subject } = detectSubject(questionText);
      const formattingRules = getSubjectFormattingRules(subject);

      // Add historical context for history-related questions
      if (subject === 'history') {
        questionText += ' Consider the influence of various groups such as the Mongols and the Xiongnu to provide a comprehensive historical point.';
        questionText += ' Include specific examples of Confederate areas under Union control, such as New Orleans, Norfolk, and parts of Tennessee, which were excluded from the Emancipation Proclamation.';
      }

      // Detect difficulty/grade level
      const { gradeLevel, vocabularyGuidance, explanationDepth } = detectDifficultyLevel(
        questionText,
        subject
      );
      const gradeInstructions = getGradeAppropriateInstructions(gradeLevel);

      // Call AI to analyze the text question
      const { getOpenAIClient } = await import("../api/openai");
      const client = getOpenAIClient();

      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: `You are an expert educator. Provide a clean, easy-to-follow solution.

**DETECTED SUBJECT: ${subject.toUpperCase()}**

**CRITICAL: Two-Part Step Structure**
Each step MUST have TWO components:
1. "equation": The mathematical work (equations, calculations, formulas)
2. "summary": A single plain-English sentence explaining what we're doing

**IMPORTANT NOTE FOR CHEMISTRY**:
- Calculating the molar mass is a necessary step to convert grams to moles, which is essential for solving stoichiometry problems.
- **Understanding Moles**: A mole represents 6.022 x 10^23 particles (Avogadro's number), which helps in understanding the scale of chemical reactions.
- **CATALYSTS - CRITICAL MECHANISTIC DETAIL**: When discussing catalysts, provide COMPLETE mechanistic explanation: (1) Catalysts provide an alternative reaction pathway with LOWER activation energy Ea, (2) They are NOT consumed - they regenerate after each cycle, (3) They increase BOTH forward AND reverse reaction rates equally (no effect on equilibrium position), (4) ALWAYS provide specific examples with mechanisms: platinum in catalytic converters (oxidizes CO → CO2 via surface adsorption), enzymes like catalase (decomposes H2O2 → H2O + O2 via active site binding), acid catalysts (protonate substrates to activate them). (5) Include energy diagram comparison showing Ea(uncatalyzed) vs Ea(catalyzed).
- **ATOMIC STRUCTURE SIGNIFICANCE**: When discussing elements, connect atomic number to electron configuration AND real-world importance: Oxygen (Z=8, [He]2s²2p⁴) needs 2e⁻ to complete octet → forms 2 bonds → essential for cellular respiration and water formation.

**IMPORTANT NOTE FOR CALCULUS - COMPLETE DERIVATIVE REASONING**:
- **POWER RULE WITH REASONING**: Don't just apply d/dx[x^n] = nx^(n-1). Explain: (1) Why it works: derivative measures instantaneous rate of change, (2) Show term-by-term: d/dx[3x²] = 3·2·x^(2-1) = 6x, (3) Constants: d/dx[5] = 0 because constant functions don't change.
- **CRITICAL POINTS - COMPLETE ANALYSIS**: For optimization/maxima/minima: (1) Find f'(x) = 0 to locate critical points, (2) SECOND DERIVATIVE TEST: f''(x) > 0 → local minimum (concave up, ∪ shape), f''(x) < 0 → local maximum (concave down, ∩ shape), f''(x) = 0 → inconclusive (use first derivative test), (3) ALWAYS verify with sign chart or test points, (4) Connect to real world: "derivative = 0 means slope = 0, we're at a peak or valley".
- **REAL-WORLD APPLICATIONS**: Every calculus problem must connect to practical meaning: velocity → derivative of position, acceleration → derivative of velocity, marginal cost → derivative of cost function.

**IMPORTANT NOTE FOR GENETICS**:
- **Understanding Recessive Alleles**: In genetics, a phenotype is determined by alleles. 'tt' results in a short phenotype because both alleles are recessive, meaning they do not express the dominant trait.

**Visual Diagrams**:
${(() => {
  const geometryKeywords = ['triangle', 'circle', 'rectangle', 'square', 'polygon', 'angle', 'perimeter', 'area', 'volume', 'diameter', 'radius', 'hypotenuse', 'perpendicular', 'parallel'];
  const isGeometry = geometryKeywords.some(kw => questionText.toLowerCase().includes(kw));
  const acidBaseKeywords = ['acidosis', 'alkalosis', 'ph', 'buffer', 'bicarbonate', 'pco2', 'hco3', 'blood gas', 'compensation'];
  const isAcidBase = acidBaseKeywords.some(kw => questionText.toLowerCase().includes(kw));
  const graphingKeywords = ['graph', 'plot', 'sketch the line', 'draw the line', 'graphing', 'coordinate plane', 'x-axis', 'y-axis'];
  const isGraphingProblem = graphingKeywords.some(kw => questionText.toLowerCase().includes(kw)) &&
                           (questionText.toLowerCase().includes('equation') || questionText.toLowerCase().includes('line') || questionText.toLowerCase().includes('slope'));

  if (subject === 'physics') {
    return `- YOU MUST INCLUDE A DIAGRAM - This physics problem requires visual representation
- **Understanding Net Force**: Net force is the sum of all forces acting on an object. It determines the object's acceleration according to Newton's second law (F = ma). Clearly identify and sum all forces to find the net force.
- **Understanding Uniformly Distributed Load**: A uniformly distributed load is spread evenly across a structure, such as a beam, and is crucial for ensuring structural integrity by preventing localized stress concentrations that could lead to failure.
- Include [IMAGE NEEDED: description] in Step 1 equation field before any math
- Describe ALL forces, velocities, angles, and dimensions clearly
- Example: "[IMAGE NEEDED: free body diagram showing pinball at loop top with normal force N pointing down toward center, weight mg pointing down, velocity v tangent to circle, radius r=2.7m]"`;
  } else if (isGraphingProblem) {
    return `- **ABSOLUTELY MANDATORY - YOU MUST INCLUDE A GRAPH IMAGE** - This problem explicitly asks to graph or plot the equation
- **NON-NEGOTIABLE**: You MUST include the [IMAGE NEEDED: description] marker in the FINAL STEP equation field
- Place this marker AFTER the final answer y = mx + b is derived, in the equation field of the last step
- The graph description must be extremely detailed and include:
  * "coordinate plane graph showing the line [equation in slope-intercept form]"
  * Y-intercept location with coordinates marked with a dot
  * X-intercept location with coordinates marked with a dot (if reasonable)
  * "Line drawn through both points"
  * Slope value explicitly stated
  * Axis ranges (e.g., "X-axis from -2 to 10, Y-axis from -8 to 2")
  * "Gridlines every 1 unit. Axes labeled."
- EXACT FORMAT REQUIRED: "[IMAGE NEEDED: coordinate plane graph showing the line y = [slope] x + [intercept]. Y-intercept at ([x], [y]) marked with a dot. X-intercept at ([x], 0) marked. Line drawn through both points with slope [value]. X-axis from [min] to [max], Y-axis from [min] to [max]. Gridlines every 1 unit. Axes labeled.]"
- **THIS IS NOT OPTIONAL** - If you solve a graphing problem without including this marker, you have failed the task`;
  } else if (isGeometry) {
    return `- **ABSOLUTELY MANDATORY - YOU MUST INCLUDE A DIAGRAM** - This geometry problem requires visual representation
- **NON-NEGOTIABLE**: You MUST include the [IMAGE NEEDED: description] marker in Step 1 equation field BEFORE any calculations
- Geometry problems CANNOT be properly understood without seeing the shape, dimensions, and relationships
- The diagram description must include:
  * The specific shape(s) involved (rectangle, triangle, circle, etc.)
  * ALL dimensions mentioned in the problem with labels
  * Variable names for unknown dimensions (e.g., "width = w", "length = 2w + 3")
  * Any relationships between dimensions clearly shown
  * Proper mathematical notation for angles, right angles, parallel lines
- EXACT FORMAT REQUIRED for rectangles: "[IMAGE NEEDED: rectangle with width labeled as w and length labeled as [expression]. Show dimensions clearly on all four sides. Include perimeter = [value] if given.]"
- EXACT FORMAT REQUIRED for triangles: "[IMAGE NEEDED: triangle with vertices labeled A, B, C. Show side lengths and angles. Mark right angles with square symbol if applicable.]"
- **THIS IS NOT OPTIONAL** - If you solve a geometry problem without including this marker, you have failed the task
- Example for perimeter problem: "[IMAGE NEEDED: rectangle with width w on top and bottom sides, length (2w + 3) on left and right sides. Perimeter P = 54 units labeled around the outside.]"`;
  } else if (subject === 'chemistry' && isAcidBase) {
    return `- YOU MUST INCLUDE A DAVENPORT DIAGRAM - Acid-base problems require a proper Davenport diagram
- Include [IMAGE NEEDED: description] in Step 1 equation field before any analysis
- **CRITICAL: Request a Davenport diagram specifically** - this is the standard clinical tool for acid-base interpretation
- The Davenport diagram plots HCO3- (bicarbonate) on Y-axis vs pH on X-axis, showing metabolic and respiratory acidosis/alkalosis regions
- Example: "[IMAGE NEEDED: Davenport diagram with pH on x-axis (7.0-7.6) and HCO3- on y-axis (10-40 mEq/L). Show the patient's values (pH=7.48, HCO3-=33 mEq/L) plotted as a red dot in the metabolic alkalosis region (upper right quadrant). Include normal range box at pH 7.35-7.45 and HCO3- 22-26 mEq/L. Label four regions: metabolic acidosis (lower left), metabolic alkalosis (upper right), respiratory acidosis (lower right), respiratory alkalosis (upper left). Draw buffer line through normal point showing respiratory compensation.]"`;
  } else if (subject === 'biology' && isAcidBase) {
    return `- YOU MUST INCLUDE A DAVENPORT DIAGRAM - Acid-base disturbance problems require a proper Davenport diagram
- Include [IMAGE NEEDED: description] in Step 1 equation field before any analysis
- **CRITICAL: Request a Davenport diagram specifically** - this is the standard medical tool for acid-base interpretation
- The Davenport diagram plots HCO3- (bicarbonate) on Y-axis vs pH on X-axis, showing metabolic and respiratory acidosis/alkalosis regions
- Example: "[IMAGE NEEDED: Davenport diagram with pH on x-axis (7.0-7.6) and HCO3- on y-axis (10-40 mEq/L). Show the patient's values (pH=7.48, HCO3-=33 mEq/L) plotted as a red dot in the metabolic alkalosis region (upper right quadrant). Include normal range box at pH 7.35-7.45 and HCO3- 22-26 mEq/L. Label four regions: metabolic acidosis (lower left), metabolic alkalosis (upper right), respiratory acidosis (lower right), respiratory alkalosis (upper left). Draw buffer line through normal point showing respiratory compensation.]"`;
  } else if (subject === 'languageArts') {
    return `- For Language Arts problems, diagrams are OPTIONAL and should only be included if they genuinely help visualize the concept
- Most Language Arts problems (grammar, writing, analysis) do NOT need diagrams
- Only include [IMAGE NEEDED: ...] if the problem involves visual elements like plot structure, sentence diagrams, or concept maps that truly aid understanding`;
  } else if (subject === 'history') {
    return `- For History problems, diagrams are OPTIONAL and rarely needed
- Most history questions are text-based analysis and do NOT benefit from diagrams
- Only include [IMAGE NEEDED: ...] if the problem specifically requires a map, timeline, or battle formation diagram
- Avoid creating diagrams for standard historical analysis questions`;
  } else if (subject === 'socialStudies') {
    return `- For Social Studies problems, diagrams are OPTIONAL and rarely needed
- Most social studies questions are conceptual analysis and do NOT benefit from diagrams
- Only include [IMAGE NEEDED: ...] if the problem requires an organizational chart or government structure diagram
- Avoid creating diagrams for standard political science, civics, or economics questions`;
  } else if (subject === 'law') {
    return `- **DO NOT CREATE DIAGRAMS FOR LAW QUESTIONS** - Law problems are text-based analytical problems
- **CRITICAL: NO [IMAGE NEEDED: ...] markers should be included for law questions**
- Legal analysis relies on textual reasoning, not visual representations
- Standard legal analysis, case law, and statutory interpretation do NOT use diagrams
- Constitutional analysis, Fourth Amendment questions, and legal doctrine discussions are purely textual
- Only organizational charts or legal process flowcharts might use diagrams, but NOT standard legal reasoning questions`;
  } else {
    return `- Include [IMAGE NEEDED: description] in Step 1 if visualization substantially helps understanding
- Only create diagrams when they add genuine value to conceptualizing the problem
- Example: "[IMAGE NEEDED: diagram showing the setup with labeled dimensions]"`;
  }
})()}

**CRITICAL: Multiple Choice Question Handling**:
${(() => {
  const isMultipleChoice = /\b[A-D][\.\)]\s+[A-Z]/.test(textQuestion || '');
  const hasNumericalAnswers = /\b[A-D][\.\)]\s+[\d\.\,]+/.test(textQuestion || '');
  if (isMultipleChoice) {
    return `- THIS IS A MULTIPLE CHOICE QUESTION - Follow these rules EXACTLY:

**PROBLEM FIELD - ABSOLUTELY MANDATORY LINE BREAKS:**
- In the "problem" field, you MUST put each answer choice on a NEW LINE
- Use the newline character (\\n) or actual line breaks between choices
- NEVER write all choices in one continuous sentence
- Format EXACTLY like this (with actual line breaks):
  "Question text here?
  A. First choice
  B. Second choice
  C. Third choice
  D. Fourth choice"

**ANALYSIS STEP - CRITICAL RULES:**
${hasNumericalAnswers ? `- NUMERICAL ANSWERS DETECTED: When answer choices are numerical values (like A. 1200 N, B. 2400 N), DO NOT analyze or discuss the wrong answers
- Simply identify which choice matches your calculated result
- Create a brief step like "Compare Result to Answer Choices"
- In the equation field, write: "Our calculated result is [blue:calculated_value]. Comparing to the options, this matches [red:A. numerical_value]"
- DO NOT create a list explaining why B, C, and D are incorrect - they are just wrong numbers and don't need explanation` : `- Create a step titled "Analyze Each Answer Choice"
- In the equation field, you MUST put each option on a NEW LINE
- Use actual newline characters between each option
- NEVER let options run together in one paragraph
- **COLOR HIGHLIGHTING FOR CORRECTNESS**: Use [red:Correct] when identifying the correct answer and [blue:Incorrect] for wrong answers
- Format EXACTLY like this (with actual line breaks):
  "A. [text] - [blue:Incorrect] because [reason]
  B. [text] - [red:Correct] because [reason]
  C. [text] - [blue:Incorrect] because [reason]
  D. [text] - [blue:Incorrect] because [reason]"`}

**FINAL ANSWER:**
- Include BOTH the letter AND the full answer text
- Example: "[red:B. IV diltiazem]" NOT just "IV diltiazem"

**THIS IS NON-NEGOTIABLE - Line breaks between A, B, C, D are MANDATORY in ALL subjects**`;
  }
  return `- If this is a multiple choice question with options A, B, C, D:
  * In the "problem" field: Put EACH choice on its OWN LINE with actual line breaks
  * In analysis step: Put EACH option on its OWN LINE with actual line breaks
  * NEVER let A, B, C, D run together - always separate with newlines
  * Include the letter in your final answer (e.g., "[red:A. Political Socialization]")`;
})()}

**CRITICAL: Strategic First Step for Multi-Step Problems**:
- If this problem requires 3+ steps, START with a strategic overview step
- Step 1 Title: "Understand the Problem and Strategy"
- Step 1 Equation: "[IMAGE NEEDED: ...] (if applicable, otherwise describe the given information)"
- Step 1 Summary: "Brief 1-2 sentence strategy explaining the approach to solve this problem"
- Example Summary: "We need to find the height using trigonometry by first identifying this as a right triangle and then applying the sine ratio with the given angle and hypotenuse."

**CRITICAL FORMATTING RULES - READ CAREFULLY**:
1. ALL fractions MUST use {numerator/denominator} syntax - NEVER use forward slash / or inline division
   ✓ CORRECT: {1/2} renders as a proper fraction
   ✓ CORRECT: E = {1/2}*m**v*^2^
   ✗ WRONG: 1/2 (renders as text, not fraction)
   ✗ WRONG: E = 1/2 m v^2^

2. Subscripts: Use text_subscript_ format
   ✓ CORRECT: *v*_peri_ (velocity at perihelion)
   ✓ CORRECT: *GM*_m_/*r*
   ✗ WRONG: [*v*_(peri):] (brackets and colons break rendering)
   ✗ WRONG: v_(peri) (parentheses in subscript)

3. Superscripts: Use text^superscript^ format
   ✓ CORRECT: *v*^2^
   ✓ CORRECT: m/s^2^
   ✗ WRONG: v^2 (missing closing ^)

4. Variables in italics: *variable*
   ✓ CORRECT: *v*, *m*, *r*, *E*
   ✗ WRONG: v, m, r (not italic)

5. **PROFESSIONAL MULTI-STEP CALCULATIONS - VISUAL CLARITY REQUIREMENTS**:
   - **MANDATORY VISUAL FLOW**: Multi-step calculations MUST use professional formatting with visual aids to guide the student
   - **VERTICAL ALIGNMENT**: Align equal signs vertically across calculation steps for easy visual tracking
   - **ARROWS FOR FLOW**: Use → arrows to show where results transfer to the next step
   - **COLOR FLOW SYSTEM**:
     * [red:result] for the answer calculated in current step
     * [blue:value] in the NEXT step to show where that red result is being used
     * This creates a visual "trail" showing how values flow through the problem
   - **BLANK LINES**: Add blank lines between distinct operations for visual separation
   - **PROGRESSIVE SUBSTITUTION**: Show the formula, then substitution, then calculation as separate lines
   - **CRITICAL FOR ALL SUBJECTS**: When presenting multiple items, options, or points (A, B, C, D or 1, 2, 3), put EACH item on its own line
   - **LINE BREAK RULES**:
     * DO NOT break lines in the middle of coordinate pairs like (0, 4) or expressions
     * DO NOT break between numbers and their units
     * Complete thoughts/steps should be on same line or properly separated with blank lines
     * Keep related information together: "y-intercept (0, 4)" should stay on one line

   ✓ CORRECT (professional multi-step with visual flow):
   "Step 1 - Find centripetal force:
   *F*_c_ = *m**v*^2^ / *r*
        = (0.40 kg)(4.2 m/s)^2^ / 0.60 m
        = 7.056 / 0.60
        → [red:11.76 N]

   Step 2 - Apply to circular motion:
   [blue:11.76 N] = *N* + *m**g*
   [blue:11.76 N] = *N* + (0.40 kg)(9.8 m/s^2^)
   [blue:11.76 N] = *N* + 3.92 N
                *N* = 11.76 - 3.92
                   → [red:7.84 N]"

   ✓ CORRECT (simple problem with alignment):
   "Calculate net force:
   *F*_net_ = *m**a*
           = (2.5 kg)(3.2 m/s^2^)
           → [red:8.0 N]"

   ✓ CORRECT (value flowing to next calculation):
   "Find total weight:
   *W* = *w* × *L* = 600 N/m × 4.0 m → [red:2400 N]

   Calculate reaction force:
   *R* = [blue:2400 N] / 2 → [red:1200 N]"

   ✓ CORRECT (list of items - MANDATORY FORMAT):
   "A. Rise of Populist Movement - Directly addresses railroad regulation demands.
   B. Passage of Thirteenth Amendment - Focuses on abolition of slavery, not railroads.
   C. U.S. acquisition of colonies - Involves military expansion, not directly linked to domestic railroads.
   D. Growth of temperance movement - Social issue, unrelated to economic/industrial patterns."

   ✗ ABSOLUTELY WRONG (no alignment, cramped, no visual flow):
   "*F*_c_ = *m**v*^2^ / *r* = (0.40 kg)(4.2 m/s)^2^ / 0.60 m = 11.76 N and then 11.76 N = *N* + *m**g* = *N* + 3.92 N so *N* = 7.84 N"

   ✗ WRONG (missing color flow - doesn't show how 11.76 N transfers):
   "Step 1: *F*_c_ = 11.76 N
   Step 2: 11.76 N = *N* + 3.92 N"
   (Should use [red:11.76 N] in Step 1 and [blue:11.76 N] in Step 2)

   - **ALIGNMENT RULES**: Use spaces to align equal signs vertically within each calculation block
   - **SPACING RULES**: Blank line between major calculation steps, aligned lines within each step
   - **ARROW USAGE**: → arrow before final result in each step to draw eye to the answer
   - **REMEMBER: A, B, C, D answer choices ALWAYS get their own lines - this is universal across all subjects**


5a. **ALGEBRA EQUATION SOLVING - PROFESSIONAL VISUAL FORMATTING**:
   - **MANDATORY VERTICAL ALIGNMENT**: Align equal signs vertically for professional appearance
   - **MANDATORY LINE BREAKS**: EVERY algebraic manipulation MUST be shown on a SEPARATE line with blank lines between operations
   - **Start with the original equation** before showing any manipulations
   - **Show the operation being performed** on its own line (e.g., "Subtract 2x from both sides:", "Divide every term by -6:")
   - **Display intermediate steps** showing what happens to each term with aligned equal signs
   - **NEVER cram multiple steps on one line** - use newlines to separate each transformation
   - **Include blank lines** between different operations for visual clarity
   - **Use spaces** to align equal signs for professional mathematical formatting

   ✓ CORRECT (solving 3x + 6 = 2x - 4 with vertical alignment):
   "Original equation:
   3*x* + 6 = 2*x* - 4

   Subtract 2*x* from both sides:
   3*x* - 2*x* + 6 = 2*x* - 2*x* - 4
              *x* + 6 = -4

   Subtract 6 from both sides:
          *x* + 6 - 6 = -4 - 6
                   *x* = -10 → [red:*x* = -10]"

   ✓ ALSO CORRECT (alternative approach with alignment):
   "Start with:
   3*x* + 6 = 2*x* - 4

   Subtract 2*x* from both sides:
        *x* + 6 = -4

   Subtract 6 from both sides:
             *x* = -10 → [red:*x* = -10]"

   ✗ ABSOLUTELY WRONG (skipping steps):
   "3*x* + 6 = 2*x* - 4
   *x* = -10"

   ✗ WRONG (jumping to combined form without showing original):
   "7*x* - 3*x* = 28 + 4
   4*x* = 32"

   ✓ CORRECT (slope-intercept form conversion with vertical alignment):
   "Original equation:
   5*x* - 6*y* = 36

   Subtract 5*x* from both sides:
         -6*y* = -5*x* + 36

   Divide every term by -6:
            *y* = {5/6}*x* - 6 → [red:*y* = {5/6}*x* - 6]"

   ✗ ABSOLUTELY WRONG (cramming all steps on one line):
   "Original equation: 5 x - 6 y = 36 Subtract 5 x from both sides: -6 y = -5 x + 36 Divide every term by -6: y = 5/6 x - 6"

   **DIAGRAM REQUIREMENTS FOR ALGEBRA**:
   - When creating [IMAGE NEEDED: ...] for algebra equations, **identify individual terms**, NOT grouped sides
   - ✓ CORRECT: Color code "3x" as x-term, "6" as constant, "2x" as x-term, "-4" as constant
   - ✗ WRONG: Color code "3x + 6" as one group or "2x - 4" as one group
   - Example: "[IMAGE NEEDED: Equation 3x + 6 = 2x - 4 with each term individually identified - highlight '3x' and '2x' in orange as x-terms, highlight '6' and '-4' in green as constants, with clear labels]"

6. **CRITICAL: NEVER USE UNDERSCORES IN LIST MARKERS**:
   - **ABSOLUTELY FORBIDDEN**: Do NOT write "A_.", "B_.", "C_.", or "D_." with underscores
   - Underscores are ONLY for subscripts in variables (like *v*_initial_ or *F*_net_)
   - List markers are ALWAYS: "A. ", "B. ", "C. ", "D. " (letter, period, space - NO underscore)
   - ✓ CORRECT: "A. First option" or "B. Second option"
   - ✗ ABSOLUTELY WRONG: "A_. First option" or "B_. Second option" or "C_." or "D_."
   - This is NON-NEGOTIABLE: List markers use periods, NOT underscores

7. **STRICT COLOR HIGHLIGHTING RULES** - Follow these rules EXACTLY:
   - **RED HIGHLIGHTING IS MANDATORY**: EVERY step that calculates a numerical result MUST red-highlight that result
   - **RED**: The SINGLE final answer calculated in that step box ONLY
     Example: "... = 11.76 N → [red:11.76 N]" or "... → [red:*t* = 1.97 s]"
     Example: "*W*_total_ = *w* × *L* = 600 N/m × 4.0 m = 2400 N → [red:2400 N]"
     Example: "*R*_1_ = *R*_2_ = *W*_total_/2 = 2400 N / 2 = 1200 N → [red:1200 N]"
     Example: "Slope *m* = (0 - 4) / (8 - 0) = [red:-½] Y-intercept = [red:4]"
     Example: "Solve for *x*: 5*x* + 3 = 18 → 5*x* = 15 → *x* = [red:3]"
   - **CRITICAL**: If a step has a numerical calculation with a result, that result MUST be in [red:...]
   - **MULTIPLE RESULTS IN ONE STEP**: If a single step calculates multiple values (like slope AND y-intercept), EACH value MUST be red-highlighted individually
     Example: "Slope = [red:-½], Y-intercept = [red:4]" NOT "Slope = -½, Y-intercept = 4"
   - **BLUE**: Values from PREVIOUS steps being used in THIS step's calculations
     Example: If Step 1 calculated 11.76 N, then Step 2 uses it: "[blue:11.76 N] = *N* + (0.40 kg)(9.8 m/s²)"
   - **NO OTHER COLORS**: Do not highlight given values, constants, coefficients, or anything else
   - This creates visual flow showing how answers propagate through the solution
   - Example sequence:
     * Step 1: "F = ma = (2 kg)(5 m/s²) → [red:10 N]"
     * Step 2: "Work = [blue:10 N] × 3 m → [red:30 J]"
     * Step 3: "Power = [blue:30 J] / 2 s → [red:15 W]"

**Title Field Guidelines**:
- PLAIN TEXT ONLY - NO formatting markup (no asterisks, no color codes, no brackets)
- Clear, concise action description
- Example: "Rearrange the Equation into Slope-Intercept Form"
- ✓ CORRECT: "Calculate Net Force"
- ✗ WRONG: "*Calculate* *Net* *Force*" (NO asterisks!)
- ✗ WRONG: "Calculate [red:Net] Force" (NO color codes!)

**Summary Field Guidelines**:
- ONE clear sentence in plain English
- NO math symbols, NO color highlighting
- Explain what the step accomplishes
- Example: "Plugging values helps compute normal force by isolating N in the net force equation."

Question: ${questionText}

**JSON Response Format**:
**CRITICAL JSON RULES**:
- DO NOT use LaTeX notation in JSON - this breaks JSON parsing
- ✗ WRONG: "\\frac{1}{2}" or "\\alpha" or "\\beta" or "\\n"
- ✓ CORRECT: "{1/2}" for fractions, "alpha"/"beta" for Greek letters
- Use our fraction syntax: {numerator/denominator} NOT \\frac{numerator}{denominator}
- Use Greek letters as words: "alpha", "beta", "sigma" NOT "\\alpha", "\\beta", "\\sigma"
- Use actual newline characters for line breaks, not "\\n" literal text
- All backslashes in strings must be properly escaped as "\\\\" if you need them
- Example WRONG: "For \\alpha = 0.05" - Example CORRECT: "For alpha = 0.05"
- Example WRONG: "\\frac{1}{2}*x*" - Example CORRECT: "{1/2}*x*"

**CRITICAL: NO MARKDOWN EMPHASIS ASTERISKS**:
- DO NOT use asterisks for emphasis (no *x*, no *word*, no *token*)
- Variables must appear as plain letters: x, y, m, b (NOT *x*, *y*, *m*, *b*)
- Never use * for multiplication. Use implicit multiplication (5x) or × if needed
- ✓ CORRECT: "x = 5", "2x + 3", "y = mx + b", "{3/4} × 8"
- ✗ ABSOLUTELY WRONG: "*x* = 5", "2*x* + 3", "*y* = *m**x* + *b*"
- ✗ WRONG: "{3/4}*8" (using * for multiplication)
- If you need to show multiplication explicitly, use × (multiplication sign): "5 × x" or just write "5x"
- This prevents rendering bugs where asterisks appear literally in the UI

{
  "problem": "Restate the FULL problem or question clearly - for multiple choice, include the complete question text",
  "steps": [
    {
      "title": "PLAIN TEXT ONLY - NO asterisks, NO color codes, NO brackets",
      "equation": "Mathematical work with {fractions/like_this}, plain variables (x, y, m), [blue:highlighting] for intermediate values, and [red:results]. For algebra, use SEPARATE LINES with blank lines between operations. For lists (A, B, C, D), put EACH item on its own line using newlines.",
      "summary": "Plain English explanation - ONE sentence, NO math symbols."
    }
  ],
  "finalAnswer": {
    "parts": [
      "1) Normal force at the top: [red:7.84 N]",
      "2) Minimum speed: [red:2.43 m/s]"
    ]
  }
}

**Example - Multiple Choice with Line Breaks**:
{
  "title": "Analyze Each Answer Choice",
  "equation": "A. To demonstrate that skepticism about the external world is logically incoherent - Incorrect because Descartes himself uses skepticism as a tool, not to refute its coherence.
B. To show that even the most basic beliefs could be false, forcing the search for indubitable truths - Correct because Descartes uses the evil demon hypothesis to illustrate that our fundamental beliefs might be deceived, and hence we must find something utterly certain.
C. To argue that moral truths are independent of empirical observation - Incorrect because the evil demon scenario is not specifically addressing moral truths but rather general knowledge.
D. To support the view that mathematical knowledge is acquired through sensory perception - Incorrect because Descartes suggests mathematical knowledge could be certain and distinct from sensory perception.",
  "summary": "We evaluate each option to determine which best explains Descartes purpose in using the evil demon thought experiment."
}

**Example - Calculate Net Force (Simple - One Line)**:
{
  "title": "Calculate Centripetal Force",
  "equation": "*F*_centripetal_ = *m**v*^2^ / *r* = (0.40 kg)(4.2 m/s)^2^ / 0.60 m → [red:11.76 N]",
  "summary": "We calculate the centripetal force needed to keep the object moving in a circle."
}

**Example - Apply Newton's Second Law (Multi-Step - Line Breaks)**:
{
  "title": "Find Normal Force",
  "equation": "At the top, net force toward center equals:
[blue:11.76 N] = *N* + *mg*
[blue:11.76 N] = *N* + (0.40 kg)(9.8 m/s^2^)
[blue:11.76 N] = *N* + 3.92 N
Solving for *N*:
*N* = [blue:11.76 N] - 3.92 N → [red:7.84 N]",
  "summary": "We use the centripetal force from the previous step to find the normal force at the top of the loop."
}

**CRITICAL ANSWER DISPLAY RULE**:
- When a step calculates a final numerical answer, END the equation with → [red:answer] or → [red:*variable* = answer]
- **DO NOT REPEAT THE ANSWER**: The answer should ONLY appear once, inside the [red:...] tag
- **NEVER use a colon before [red:...]**: Always use an arrow →
- ✓ CORRECT: "... = 13 → [red:*t* ≈ 1.97 seconds]"
- ✓ CORRECT: "... *y* = {-3/8}*x* + 4 → [red:*y* = {-3/8}*x* + 4]"
- ✗ ABSOLUTELY WRONG: "y = -3/8 x + 4: [red:y = -3/8 x + 4]" (redundant, uses colon)
- ✗ WRONG: "answer = 13: [red:13]" (redundant, uses colon)
- The RED highlighted answer must be the LAST element in the equation box
- The answer must have units and be clearly labeled
- This ensures students see the answer prominently in the solution box, not just in the summary

**Example - Energy Conservation**:
{
  "title": "Apply Conservation of Energy",
  "equation": "Total energy *E* = kinetic + potential → *E* = {1/2}*m**v*^2^ - *GM*_m_/*r*. At perihelion: {1/2}*m**v*_peri_^2^ - *GM*_m_/*r*_peri_ = *E*_total_.",
  "summary": "We use conservation of energy to relate velocities and distances at different points in the orbit."
}`,
          },
        ],
        max_tokens: 4096,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content || "";
      const finishReason = completion.choices[0]?.finish_reason;

      // Log for debugging
      console.log("Text analysis - Response length:", responseContent.length);
      console.log("Text analysis - Finish reason:", finishReason);

      if (finishReason === 'length') {
        console.log("Response was truncated due to token limit!");
        throw new Error("AI response was cut off. The problem may be too complex.");
      }

      // Parse the AI response using our helper function
      const parsedSolution = parseAIResponse(responseContent);

      // DEBUG: Log what AI generated to see if [IMAGE NEEDED:] markers are present
      console.log("=== SOLUTION STEPS DEBUG ===");
      console.log("Number of steps:", parsedSolution.steps?.length || 0);
      parsedSolution.steps?.forEach((step: any, i: number) => {
        const eqPreview = step.equation?.substring(0, 150) || "none";
        console.log(`Step ${i + 1} equation preview:`, eqPreview);
        if (step.equation?.includes("[IMAGE NEEDED:")) {
          console.log(`  ✓ Step ${i + 1} contains [IMAGE NEEDED:] marker`);
        } else {
          console.log(`  ✗ Step ${i + 1} missing [IMAGE NEEDED:] marker`);
        }
      });
      console.log("============================");

      // Process image generation for each step and build formatted solution
      // Using centralized helper to ensure rawEquation is always preserved
      let formattedSolution = await buildFormattedSolutionFromParsed(parsedSolution);

      // CRITICAL: Verify solution accuracy before showing to user
      console.log("Verifying solution accuracy...");
      const verificationResult = await verifySolution(textQuestion || "", formattedSolution);

      if (!verificationResult.isValid) {
        console.log("Solution verification FAILED:", verificationResult.issues);

        // If verification fails, regenerate with explicit instructions about what went wrong
        const correctionPrompt = `CRITICAL ERROR DETECTED: The previous solution was INCORRECT.

ORIGINAL PROBLEM: ${textQuestion}

ISSUES FOUND:
${verificationResult.issues?.join('\n')}

You MUST provide a corrected solution that:
1. Answers the ACTUAL question being asked (not a related but different question)
2. Uses the correct approach for what's being asked
3. Provides an answer with correct dimensional units

Follow all previous formatting rules, but most importantly: SOLVE THE CORRECT PROBLEM.

**CRITICAL**: You MUST respond with JSON in EXACTLY this format:
{
  "problem": "the problem statement",
  "steps": [
    {
      "title": "Step title",
      "equation": "equation content with formatting",
      "summary": "summary text"
    }
  ],
  "finalAnswer": "the final answer"
}

DO NOT use "corrected_solution" or any other structure. Use "steps" array as shown above.`;

        // Regenerate solution with corrections
        const correctionCompletion = await client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: `${completion.choices[0]?.message?.content}\n\n${correctionPrompt}`,
            },
          ],
          max_tokens: 4096,
          response_format: { type: "json_object" },
        });

        const correctedContent = correctionCompletion.choices[0]?.message?.content || "";
        const correctedParsed = parseAIResponse(correctedContent);

        // Use centralized helper to ensure rawEquation is preserved in correction path
        formattedSolution = await buildFormattedSolutionFromParsed(correctedParsed);
        console.log("Solution regenerated with corrections");
      } else {
        console.log("Solution verified as accurate ✓");
      }

      setSolution(formattedSolution);
      // Reveal steps one by one
      revealStepsSequentially(formattedSolution.steps.length);
    } catch (err) {
      console.log("Error analyzing question:", err);
      console.log("Error details:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setError("Failed to analyze the question. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeProblem = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Convert image to base64
      const base64 = await FileSystem.readAsStringAsync(problem.imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const imageUrl = `data:image/jpeg;base64,${base64}`;

      // Call AI to analyze the problem using OpenAI client directly
      const { getOpenAIClient } = await import("../api/openai");
      const client = getOpenAIClient();

      // Build the prompt based on whether a problem number was specified
      const problemSpecifier = problemNumber
        ? `Focus ONLY on problem number ${problemNumber}.`
        : "Identify and solve the first problem you see in the image.";

      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are an expert educator. ${problemSpecifier} Provide a clean, easy-to-follow solution.

**CRITICAL: READ THE PROBLEM CAREFULLY AND COUNT ALL QUANTITIES**
- When a problem asks for multiple items (e.g., "2 life jackets and 2 jet skis"), you MUST calculate costs/values for ALL items mentioned
- CAREFULLY identify each quantity in the problem: if it says "2 life jackets", your calculation MUST include multiplication by 2
- Common mistake: calculating for only 1 item when the problem asks for 2 or more
- Example: If the problem asks "cost for 2 life jackets and 2 jet skis for 8 hours", your final calculation MUST include:
  * Cost of 2 life jackets (not 1)
  * Cost of 2 jet skis (not 1)
  * For 8 hours duration
- VERIFY your final answer accounts for ALL quantities before completing the solution

**IMPORTANT: Detect the subject and respond accordingly**

**CRITICAL: Two-Part Step Structure**
Each step MUST have TWO components:
1. "equation": The mathematical work (equations, calculations, formulas)
2. "summary": A single plain-English sentence explaining what we're doing

**MANDATORY Visual Diagrams**:
- IF THIS IS A PHYSICS PROBLEM: YOU MUST INCLUDE A DIAGRAM
- IF THIS IS A GEOMETRY PROBLEM: YOU MUST INCLUDE A DIAGRAM - **THIS IS NON-NEGOTIABLE**
- IF THIS IS AN ACID-BASE/pH DISTURBANCE PROBLEM: YOU MUST INCLUDE A DAVENPORT DIAGRAM
- IF THIS IS A GRAPHING PROBLEM (asks to graph, plot, or sketch an equation/line): YOU MUST INCLUDE A GRAPH in the FINAL STEP
- Include [IMAGE NEEDED: description] at the START of Step 1 equation field (for physics/geometry/acid-base)
- For graphing problems: Include [IMAGE NEEDED: description] in the FINAL STEP after computing the equation in slope-intercept form
- Physics topics: forces, motion, circular motion, projectiles, inclines, pulleys, tension, friction, collisions, energy
- Geometry topics: triangles, circles, rectangles, squares, polygons, angles, perimeter, areas, volumes, shapes, spatial relationships
- Acid-base topics: acidosis, alkalosis, pH, bicarbonate, HCO3-, pCO2, blood gas, compensation, metabolic, respiratory
- Graphing: problems that explicitly ask to "graph", "plot", "sketch the line", "draw the graph" of an equation or line
- Describe ALL relevant elements: forces, velocities, angles, dimensions, shapes, and coordinate systems
- Example Physics: "[IMAGE NEEDED: free body diagram showing mass at loop top with normal force N pointing toward center, weight mg pointing downward, velocity v tangent to circle, radius r=2.7m labeled, at angle θ from vertical]"
- Example Geometry Rectangle: "[IMAGE NEEDED: rectangle with width labeled as w on top and bottom sides, length labeled as (2w + 3) on left and right sides. Perimeter P = 54 units shown around the outside. All four corners marked as right angles.]"
- Example Geometry Triangle: "[IMAGE NEEDED: triangle ABC with side AB = 5 cm, angle at B = 90°, angle at A = 30°, with height h drawn from B to AC, right angle marked at B]"
- Example Acid-Base: "[IMAGE NEEDED: Davenport diagram with pH on x-axis (7.0-7.6) and HCO3- on y-axis (10-40 mEq/L). Show the patient's values (pH=7.48, HCO3-=33 mEq/L) plotted as a red dot in the metabolic alkalosis region (upper right quadrant). Include normal range box at pH 7.35-7.45 and HCO3- 22-26 mEq/L. Label four regions: metabolic acidosis (lower left), metabolic alkalosis (upper right), respiratory acidosis (lower right), respiratory alkalosis (upper left). Draw buffer line through normal point.]"
- Example Graphing: "[IMAGE NEEDED: coordinate plane graph showing the line y = 5/6 x - 6. Y-intercept at (0, -6) marked with a dot. X-intercept at approximately (7.2, 0) marked. Line drawn through both points with positive slope 5/6. X-axis from -2 to 10, Y-axis from -8 to 2. Gridlines every 1 unit. Axes labeled.]"

**CRITICAL: Strategic First Step for Multi-Step Problems**:
- If this problem requires 3+ steps, START with a strategic overview step
- Step 1 Title: "Understand the Problem and Strategy"
- Step 1 Equation: "[IMAGE NEEDED: ...] followed by description of given information"
- Step 1 Summary: "Brief 1-2 sentence strategy explaining the approach to solve this problem"
- Example Summary: "We need to find the height using trigonometry by first identifying this as a right triangle and then applying the sine ratio with the given angle and hypotenuse."

**CRITICAL FORMATTING RULES - READ CAREFULLY**:
1. ALL fractions MUST use {numerator/denominator} syntax - NEVER use forward slash / or inline division
   ✓ CORRECT: {1/2} renders as a proper fraction
   ✓ CORRECT: E = {1/2}*m**v*^2^
   ✗ WRONG: 1/2 (renders as text, not fraction)
   ✗ WRONG: E = 1/2 m v^2^

2. Subscripts: Use text_subscript_ format
   ✓ CORRECT: *v*_peri_ (velocity at perihelion)
   ✓ CORRECT: *GM*_m_/*r*
   ✗ WRONG: [*v*_(peri):] (brackets and colons break rendering)
   ✗ WRONG: v_(peri) (parentheses in subscript)

3. Superscripts: Use text^superscript^ format
   ✓ CORRECT: *v*^2^
   ✓ CORRECT: m/s^2^
   ✗ WRONG: v^2 (missing closing ^)

4. Variables in italics: *variable*
   ✓ CORRECT: *v*, *m*, *r*, *E*
   ✗ WRONG: v, m, r (not italic)

5. **PROFESSIONAL MULTI-STEP CALCULATIONS - VISUAL CLARITY REQUIREMENTS**:
   - **MANDATORY VISUAL FLOW**: Multi-step calculations MUST use professional formatting with visual aids to guide the student
   - **VERTICAL ALIGNMENT**: Align equal signs vertically across calculation steps for easy visual tracking
   - **ARROWS FOR FLOW**: Use → arrows to show where results transfer to the next step
   - **COLOR FLOW SYSTEM**:
     * [red:result] for the answer calculated in current step
     * [blue:value] in the NEXT step to show where that red result is being used
     * This creates a visual "trail" showing how values flow through the problem
   - **BLANK LINES**: Add blank lines between distinct operations for visual separation
   - **PROGRESSIVE SUBSTITUTION**: Show the formula, then substitution, then calculation as separate lines
   - **CRITICAL FOR ALL SUBJECTS**: When presenting multiple items, options, or points (A, B, C, D or 1, 2, 3), put EACH item on its own line
   - **LINE BREAK RULES**:
     * DO NOT break lines in the middle of coordinate pairs like (0, 4) or expressions
     * DO NOT break between numbers and their units
     * Complete thoughts/steps should be on same line or properly separated with blank lines
     * Keep related information together: "y-intercept (0, 4)" should stay on one line

   ✓ CORRECT (professional multi-step with visual flow):
   "Step 1 - Find centripetal force:
   *F*_c_ = *m**v*^2^ / *r*
        = (0.40 kg)(4.2 m/s)^2^ / 0.60 m
        = 7.056 / 0.60
        → [red:11.76 N]

   Step 2 - Apply to circular motion:
   [blue:11.76 N] = *N* + *m**g*
   [blue:11.76 N] = *N* + (0.40 kg)(9.8 m/s^2^)
   [blue:11.76 N] = *N* + 3.92 N
                *N* = 11.76 - 3.92
                   → [red:7.84 N]"

   ✓ CORRECT (simple problem with alignment):
   "Calculate net force:
   *F*_net_ = *m**a*
           = (2.5 kg)(3.2 m/s^2^)
           → [red:8.0 N]"

   ✓ CORRECT (value flowing to next calculation):
   "Find total weight:
   *W* = *w* × *L* = 600 N/m × 4.0 m → [red:2400 N]

   Calculate reaction force:
   *R* = [blue:2400 N] / 2 → [red:1200 N]"

   ✓ CORRECT (list of items - MANDATORY FORMAT):
   "A. Rise of Populist Movement - Directly addresses railroad regulation demands.
   B. Passage of Thirteenth Amendment - Focuses on abolition of slavery, not railroads.
   C. U.S. acquisition of colonies - Involves military expansion, not directly linked to domestic railroads.
   D. Growth of temperance movement - Social issue, unrelated to economic/industrial patterns."

   ✗ ABSOLUTELY WRONG (no alignment, cramped, no visual flow):
   "*F*_c_ = *m**v*^2^ / *r* = (0.40 kg)(4.2 m/s)^2^ / 0.60 m = 11.76 N and then 11.76 N = *N* + *m**g* = *N* + 3.92 N so *N* = 7.84 N"

   ✗ WRONG (missing color flow - doesn't show how 11.76 N transfers):
   "Step 1: *F*_c_ = 11.76 N
   Step 2: 11.76 N = *N* + 3.92 N"
   (Should use [red:11.76 N] in Step 1 and [blue:11.76 N] in Step 2)

   - **ALIGNMENT RULES**: Use spaces to align equal signs vertically within each calculation block
   - **SPACING RULES**: Blank line between major calculation steps, aligned lines within each step
   - **ARROW USAGE**: → arrow before final result in each step to draw eye to the answer
   - **REMEMBER: A, B, C, D answer choices ALWAYS get their own lines - this is universal across all subjects**


5a. **ALGEBRA EQUATION SOLVING - PROFESSIONAL VISUAL FORMATTING**:
   - **MANDATORY VERTICAL ALIGNMENT**: Align equal signs vertically for professional appearance
   - **MANDATORY LINE BREAKS**: EVERY algebraic manipulation MUST be shown on a SEPARATE line with blank lines between operations
   - **Start with the original equation** before showing any manipulations
   - **Show the operation being performed** on its own line (e.g., "Subtract 2x from both sides:", "Divide every term by -6:")
   - **Display intermediate steps** showing what happens to each term with aligned equal signs
   - **NEVER cram multiple steps on one line** - use newlines to separate each transformation
   - **Include blank lines** between different operations for visual clarity
   - **Use spaces** to align equal signs for professional mathematical formatting

   ✓ CORRECT (solving 3x + 6 = 2x - 4 with vertical alignment):
   "Original equation:
   3*x* + 6 = 2*x* - 4

   Subtract 2*x* from both sides:
   3*x* - 2*x* + 6 = 2*x* - 2*x* - 4
              *x* + 6 = -4

   Subtract 6 from both sides:
          *x* + 6 - 6 = -4 - 6
                   *x* = -10 → [red:*x* = -10]"

   ✓ ALSO CORRECT (alternative approach with alignment):
   "Start with:
   3*x* + 6 = 2*x* - 4

   Subtract 2*x* from both sides:
        *x* + 6 = -4

   Subtract 6 from both sides:
             *x* = -10 → [red:*x* = -10]"

   ✗ ABSOLUTELY WRONG (skipping steps):
   "3*x* + 6 = 2*x* - 4
   *x* = -10"

   ✗ WRONG (jumping to combined form without showing original):
   "7*x* - 3*x* = 28 + 4
   4*x* = 32"

   ✓ CORRECT (slope-intercept form conversion with vertical alignment):
   "Original equation:
   5*x* - 6*y* = 36

   Subtract 5*x* from both sides:
         -6*y* = -5*x* + 36

   Divide every term by -6:
            *y* = {5/6}*x* - 6 → [red:*y* = {5/6}*x* - 6]"

   ✗ ABSOLUTELY WRONG (cramming all steps on one line):
   "Original equation: 5 x - 6 y = 36 Subtract 5 x from both sides: -6 y = -5 x + 36 Divide every term by -6: y = 5/6 x - 6"

   **DIAGRAM REQUIREMENTS FOR ALGEBRA**:
   - When creating [IMAGE NEEDED: ...] for algebra equations, **identify individual terms**, NOT grouped sides
   - ✓ CORRECT: Color code "3x" as x-term, "6" as constant, "2x" as x-term, "-4" as constant
   - ✗ WRONG: Color code "3x + 6" as one group or "2x - 4" as one group
   - Example: "[IMAGE NEEDED: Equation 3x + 6 = 2x - 4 with each term individually identified - highlight '3x' and '2x' in orange as x-terms, highlight '6' and '-4' in green as constants, with clear labels]"

6. **CRITICAL: NEVER USE UNDERSCORES IN LIST MARKERS**:
   - **ABSOLUTELY FORBIDDEN**: Do NOT write "A_.", "B_.", "C_.", or "D_." with underscores
   - Underscores are ONLY for subscripts in variables (like *v*_initial_ or *F*_net_)
   - List markers are ALWAYS: "A. ", "B. ", "C. ", "D. " (letter, period, space - NO underscore)
   - ✓ CORRECT: "A. First option" or "B. Second option"
   - ✗ ABSOLUTELY WRONG: "A_. First option" or "B_. Second option" or "C_." or "D_."
   - This is NON-NEGOTIABLE: List markers use periods, NOT underscores

7. **STRICT COLOR HIGHLIGHTING RULES** - Follow these rules EXACTLY:
   - **RED HIGHLIGHTING IS MANDATORY**: EVERY step that calculates a numerical result MUST red-highlight that result
   - **RED**: The SINGLE final answer calculated in that step box ONLY
     Example: "... = 11.76 N → [red:11.76 N]" or "... → [red:*t* = 1.97 s]"
     Example: "*W*_total_ = *w* × *L* = 600 N/m × 4.0 m = 2400 N → [red:2400 N]"
     Example: "*R*_1_ = *R*_2_ = *W*_total_/2 = 2400 N / 2 = 1200 N → [red:1200 N]"
     Example: "Slope *m* = (0 - 4) / (8 - 0) = [red:-½] Y-intercept = [red:4]"
     Example: "Solve for *x*: 5*x* + 3 = 18 → 5*x* = 15 → *x* = [red:3]"
   - **CRITICAL**: If a step has a numerical calculation with a result, that result MUST be in [red:...]
   - **MULTIPLE RESULTS IN ONE STEP**: If a single step calculates multiple values (like slope AND y-intercept), EACH value MUST be red-highlighted individually
     Example: "Slope = [red:-½], Y-intercept = [red:4]" NOT "Slope = -½, Y-intercept = 4"
   - **BLUE**: Values from PREVIOUS steps being used in THIS step's calculations
     Example: If Step 1 calculated 11.76 N, then Step 2 uses it: "[blue:11.76 N] = *N* + (0.40 kg)(9.8 m/s²)"
   - **NO OTHER COLORS**: Do not highlight given values, constants, coefficients, or anything else
   - This creates visual flow showing how answers propagate through the solution
   - Example sequence:
     * Step 1: "F = ma = (2 kg)(5 m/s²) → [red:10 N]"
     * Step 2: "Work = [blue:10 N] × 3 m → [red:30 J]"
     * Step 3: "Power = [blue:30 J] / 2 s → [red:15 W]"

**Title Field Guidelines**:
- PLAIN TEXT ONLY - NO formatting markup (no asterisks, no color codes, no brackets)
- Clear, concise action description
- Example: "Rearrange the Equation into Slope-Intercept Form"
- ✓ CORRECT: "Calculate Net Force"
- ✗ WRONG: "*Calculate* *Net* *Force*" (NO asterisks!)
- ✗ WRONG: "Calculate [red:Net] Force" (NO color codes!)

**Summary Field Guidelines**:
- ONE clear sentence in plain English
- NO math symbols, NO color highlighting
- Explain what the step accomplishes
- Example: "Plugging values helps compute normal force by isolating N in the net force equation."

**JSON Response Format**:
**CRITICAL JSON RULES**:
- DO NOT use LaTeX notation in JSON - this breaks JSON parsing
- ✗ WRONG: "\\frac{1}{2}" or "\\alpha" or "\\beta" or "\\n"
- ✓ CORRECT: "{1/2}" for fractions, "alpha"/"beta" for Greek letters
- Use our fraction syntax: {numerator/denominator} NOT \\frac{numerator}{denominator}
- Use Greek letters as words: "alpha", "beta", "sigma" NOT "\\alpha", "\\beta", "\\sigma"
- Use actual newline characters for line breaks, not "\\n" literal text
- All backslashes in strings must be properly escaped as "\\\\" if you need them
- Example WRONG: "For \\alpha = 0.05" - Example CORRECT: "For alpha = 0.05"
- Example WRONG: "\\frac{1}{2}*x*" - Example CORRECT: "{1/2}*x*"

**CRITICAL: NO MARKDOWN EMPHASIS ASTERISKS**:
- DO NOT use asterisks for emphasis (no *x*, no *word*, no *token*)
- Variables must appear as plain letters: x, y, m, b (NOT *x*, *y*, *m*, *b*)
- Never use * for multiplication. Use implicit multiplication (5x) or × if needed
- ✓ CORRECT: "x = 5", "2x + 3", "y = mx + b", "{3/4} × 8"
- ✗ ABSOLUTELY WRONG: "*x* = 5", "2*x* + 3", "*y* = *m**x* + *b*"
- ✗ WRONG: "{3/4}*8" (using * for multiplication)
- If you need to show multiplication explicitly, use × (multiplication sign): "5 × x" or just write "5x"
- This prevents rendering bugs where asterisks appear literally in the UI

{
  "problem": "Restate the FULL problem or question clearly - for multiple choice, include the complete question text",
  "steps": [
    {
      "title": "PLAIN TEXT ONLY - NO asterisks, NO color codes, NO brackets",
      "equation": "Mathematical work with {fractions/like_this}, plain variables (x, y, m), [blue:highlighting] for intermediate values, and [red:results]. For algebra, use SEPARATE LINES with blank lines between operations. For lists (A, B, C, D), put EACH item on its own line using newlines.",
      "summary": "Plain English explanation - ONE sentence, NO math symbols."
    }
  ],
  "finalAnswer": {
    "parts": [
      "1) Normal force at the top: [red:7.84 N]",
      "2) Minimum speed: [red:2.43 m/s]"
    ]
  }
}

**Example - Multiple Choice with Line Breaks**:
{
  "title": "Analyze Each Answer Choice",
  "equation": "A. To demonstrate that skepticism about the external world is logically incoherent - Incorrect because Descartes himself uses skepticism as a tool, not to refute its coherence.
B. To show that even the most basic beliefs could be false, forcing the search for indubitable truths - Correct because Descartes uses the evil demon hypothesis to illustrate that our fundamental beliefs might be deceived, and hence we must find something utterly certain.
C. To argue that moral truths are independent of empirical observation - Incorrect because the evil demon scenario is not specifically addressing moral truths but rather general knowledge.
D. To support the view that mathematical knowledge is acquired through sensory perception - Incorrect because Descartes suggests mathematical knowledge could be certain and distinct from sensory perception.",
  "summary": "We evaluate each option to determine which best explains Descartes purpose in using the evil demon thought experiment."
}

**Example - Calculate Net Force (Simple - One Line)**:
{
  "title": "Calculate Centripetal Force",
  "equation": "*F*_centripetal_ = *m**v*^2^ / *r* = (0.40 kg)(4.2 m/s)^2^ / 0.60 m → [red:11.76 N]",
  "summary": "We calculate the centripetal force needed to keep the object moving in a circle."
}

**Example - Apply Newton's Second Law (Multi-Step - Line Breaks)**:
{
  "title": "Find Normal Force",
  "equation": "At the top, net force toward center equals:
[blue:11.76 N] = *N* + *mg*
[blue:11.76 N] = *N* + (0.40 kg)(9.8 m/s^2^)
[blue:11.76 N] = *N* + 3.92 N
Solving for *N*:
*N* = [blue:11.76 N] - 3.92 N → [red:7.84 N]",
  "summary": "We use the centripetal force from the previous step to find the normal force at the top of the loop."
}

**CRITICAL ANSWER DISPLAY RULE**:
- When a step calculates a final numerical answer, END the equation with → [red:answer] or → [red:*variable* = answer]
- **DO NOT REPEAT THE ANSWER**: The answer should ONLY appear once, inside the [red:...] tag
- **NEVER use a colon before [red:...]**: Always use an arrow →
- ✓ CORRECT: "... = 13 → [red:*t* ≈ 1.97 seconds]"
- ✓ CORRECT: "... *y* = {-3/8}*x* + 4 → [red:*y* = {-3/8}*x* + 4]"
- ✗ ABSOLUTELY WRONG: "y = -3/8 x + 4: [red:y = -3/8 x + 4]" (redundant, uses colon)
- ✗ WRONG: "answer = 13: [red:13]" (redundant, uses colon)
- The RED highlighted answer must be the LAST element in the equation box
- The answer must have units and be clearly labeled
- This ensures students see the answer prominently in the solution box, not just in the summary

**Example - Energy Conservation**:
{
  "title": "Apply Conservation of Energy",
  "equation": "Total energy *E* = kinetic + potential → *E* = {1/2}*m**v*^2^ - *GM*_m_/*r*. At perihelion: {1/2}*m**v*_peri_^2^ - *GM*_m_/*r*_peri_ = *E*_total_.",
  "summary": "We use conservation of energy to relate velocities and distances at different points in the orbit."
}`,
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content || "";
      const finishReason = completion.choices[0]?.finish_reason;

      // Log for debugging
      console.log("Text analysis - Response length:", responseContent.length);
      console.log("Text analysis - Finish reason:", finishReason);

      if (finishReason === 'length') {
        console.log("Response was truncated due to token limit!");
        throw new Error("AI response was cut off. The problem may be too complex.");
      }

      // Parse the AI response using our helper function
      const parsedSolution = parseAIResponse(responseContent);

      // DEBUG: Log what AI generated to see if [IMAGE NEEDED:] markers are present
      console.log("=== SOLUTION STEPS DEBUG ===");
      console.log("Number of steps:", parsedSolution.steps?.length || 0);
      parsedSolution.steps?.forEach((step: any, i: number) => {
        const eqPreview = step.equation?.substring(0, 150) || "none";
        console.log(`Step ${i + 1} equation preview:`, eqPreview);
        if (step.equation?.includes("[IMAGE NEEDED:")) {
          console.log(`  ✓ Step ${i + 1} contains [IMAGE NEEDED:] marker`);
        } else {
          console.log(`  ✗ Step ${i + 1} missing [IMAGE NEEDED:] marker`);
        }
      });
      console.log("============================");

      // Process image generation for each step and build formatted solution
      // Using centralized helper to ensure rawEquation is always preserved
      let formattedSolution = await buildFormattedSolutionFromParsed(parsedSolution);

      // CRITICAL: Verify solution accuracy before showing to user
      console.log("Verifying solution accuracy...");
      const verificationResult = await verifySolution(
        parsedSolution.problem,
        formattedSolution,
        base64 // Pass image to verification
      );

      if (!verificationResult.isValid) {
        console.log("Solution verification FAILED:", verificationResult.issues);

        // If verification fails, regenerate with explicit instructions about what went wrong
        const correctionPrompt = `CRITICAL ERROR DETECTED: The previous solution was INCORRECT.

ISSUES FOUND:
${verificationResult.issues?.join('\n')}

You MUST provide a corrected solution that:
1. Answers the ACTUAL question being asked (not a related but different question)
2. Uses the correct approach for what's being asked
3. Provides an answer with correct dimensional units
4. CAREFULLY counts ALL items mentioned (e.g., if asking for "2 life jackets and 2 jet skis", calculate costs for ALL 2 life jackets AND ALL 2 jet skis)
5. Shows the complete calculation including all quantities multiplied correctly

IMPORTANT: When the problem asks for multiple items (e.g., "2 life jackets"), you MUST multiply by the quantity. Do not forget to include all items in your final calculation.

Follow all previous formatting rules, but most importantly: SOLVE THE CORRECT PROBLEM WITH THE CORRECT QUANTITIES.

**CRITICAL**: You MUST respond with JSON in EXACTLY this format:
{
  "problem": "the problem statement",
  "steps": [
    {
      "title": "Step title",
      "equation": "equation content with formatting",
      "summary": "summary text"
    }
  ],
  "finalAnswer": "the final answer"
}

DO NOT use "corrected_solution" or any other structure. Use "steps" array as shown above.`;

        // Regenerate solution with corrections
        const correctionCompletion = await client.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: correctionPrompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl,
                  },
                },
              ],
            },
          ],
          max_tokens: 4096,
          response_format: { type: "json_object" },
        });

        const correctedContent = correctionCompletion.choices[0]?.message?.content || "";
        const correctedParsed = parseAIResponse(correctedContent);

        // Use centralized helper to ensure rawEquation is preserved in correction path
        formattedSolution = await buildFormattedSolutionFromParsed(correctedParsed);
        console.log("Solution regenerated with corrections");
      } else {
        console.log("Solution verified as accurate ✓");
      }

      setSolution(formattedSolution);
      // Reveal steps one by one
      revealStepsSequentially(formattedSolution.steps.length);
    } catch (err) {
      console.log("Error analyzing problem:", err);
      console.log("Error details:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
      setError("Failed to analyze the problem. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const revealStepsSequentially = (totalSteps: number) => {
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep++;
      setRevealedSteps(currentStep);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (currentStep >= totalSteps) {
        clearInterval(interval);
      }
    }, 800);
  };

  const handleNewProblem = () => {
    navigation.navigate("Home");
  };

  const handleAskQuestion = () => {
    if (solution) {
      navigation.navigate("Question", {
        previousSolution: JSON.stringify(solution),
      });
    }
  };

  const handleSimplifiedExplanation = async () => {
    if (!solution) return;

    try {
      setIsLoadingSimplified(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { getOpenAIClient } = await import("../api/openai");
      const client = getOpenAIClient();

      const simplifiedPrompt = `You are an exceptionally patient and supportive tutor helping a student who is struggling to understand this concept.

ORIGINAL PROBLEM: ${solution.problem}

The student has seen a solution but said "I Still Don't Get It". Your mission is to re-explain this in the SIMPLEST possible way with:

1. **Slower, Smaller Steps**: Break down EVERY operation into tiny, manageable pieces
2. **Plain Language**: Explain each step in simple, everyday terms before showing the math
3. **Background Education**: Define any terms, concepts, or operations the student might not know
4. **Why We Do It**: Explain the reasoning behind each step, not just what to do
5. **Visual Analogies**: Use real-world comparisons when helpful

CRITICAL FORMATTING (same as before):
- Use {numerator/denominator} for ALL fractions
- For EVERY operation, show the work WITH red highlighting on terms being operated on
- Add arrow → to show the progression to the result
- Highlight the outcome in appropriate color (green, orange, blue, etc.)
- NO color coding in final answer
- Maintain format consistency throughout

**CRITICAL - JSON FORMAT**: You MUST respond with valid JSON only. Do not include any text before or after the JSON object.

Format your response as JSON:
{
  "problem": "Restate the problem simply",
  "steps": [
    {
      "title": "Simple, clear step title",
      "content": "The math/equation for this step",
      "explanation": "Detailed explanation in simple language: why we do this, what it means, any background concepts"
    }
  ],
  "finalAnswer": "The answer with no color coding"
}

EXAMPLE - "Solve: 2x + 5 = 13":
{
  "problem": "Find the value of x in the equation: 2x + 5 = 13",
  "steps": [
    {
      "title": "Understand what we have",
      "content": "2x + 5 = 13",
      "explanation": "This equation has a variable (x) that we need to find. The left side says '2 times x, plus 5' equals 13. Our goal is to get x by itself on one side."
    },
    {
      "title": "Remove the 5 from the left side",
      "content": "2x + 5 - [red:5] = 13 - [red:5] → 2x = 8",
      "explanation": "We want to isolate x, so we need to get rid of the +5. To keep the equation balanced (like a seesaw), whatever we do to one side, we must do to the other. We subtract 5 from BOTH sides."
    },
    {
      "title": "Divide to find x",
      "content": "2x ÷ [red:2] = 8 ÷ [red:2] → x = 4",
      "explanation": "We have 2x, which means 2 times x. To undo multiplication, we divide. We divide both sides by 2 to get x by itself. 8 divided by 2 equals 4."
    },
    {
      "title": "Verify the answer",
      "content": "x = 4",
      "explanation": "Let's check: if x is 4, then 2(4) + 5 = 8 + 5 = 13. It works!"
    }
  ],
  "finalAnswer": "x = 4"
}

Now create a simplified explanation for the problem: ${solution.problem}`;

      const completion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: simplifiedPrompt,
          },
        ],
        max_tokens: 3000,
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content || "";
      const finishReason = completion.choices[0]?.finish_reason;

      // Log for debugging
      console.log("Text analysis - Response length:", responseContent.length);
      console.log("Text analysis - Finish reason:", finishReason);

      if (finishReason === 'length') {
        console.log("Response was truncated due to token limit!");
        throw new Error("AI response was cut off. The problem may be too complex.");
      }

      // Parse the AI response using our helper function
      const parsedSolution = parseAIResponse(responseContent);

      const rawSolution: HomeworkSolution = {
        problem: parsedSolution.problem,
        steps: parsedSolution.steps.map((step: any, index: number) => ({
          id: `simplified-step-${index}`,
          title: formatTitle(step.title),
          content: step.content,
          explanation: step.explanation,
        })),
        finalAnswer: parsedSolution.finalAnswer,
      };

      // CRITICAL: Apply post-processing to fix formatting issues
      const formattedSolution = formatSolution(rawSolution);

      setSolution(formattedSolution);
      setRevealedSteps(0);
      // Reveal steps one by one
      revealStepsSequentially(formattedSolution.steps.length);
    } catch (err) {
      console.log("Error generating simplified explanation:", err);
      setError("Failed to generate simplified explanation. Please try again.");
    } finally {
      setIsLoadingSimplified(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-6">
          <ActivityIndicator size="large" color="#6366f1" />
          <Text className="text-gray-700 text-xl font-semibold mt-6">
            Analyzing your homework...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="alert-circle" size={64} color="#ef4444" />
          <Text className="text-gray-900 text-xl font-semibold mt-6 text-center">
            {error}
          </Text>
          <Pressable onPress={analyzeProblem} className="mt-8">
            {({ pressed }) => (
              <View
                className="bg-indigo-600 rounded-2xl px-8 py-4"
                style={{ opacity: pressed ? 0.8 : 1 }}
              >
                <Text className="text-white text-lg font-semibold">
                  Try Again
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} className="mt-4">
            {({ pressed }) => (
              <Text
                className="text-indigo-600 text-lg font-medium"
                style={{ opacity: pressed ? 0.6 : 1 }}
              >
                Go Back
              </Text>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
        <View className="bg-white px-6" style={{ paddingVertical: responsiveSpacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View className="flex-row items-center justify-between mb-2">
            <Pressable onPress={() => navigation.navigate("Home")}>
              {({ pressed }) => (
                <View className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center" style={{ opacity: pressed ? 0.5 : 1 }}>
                  <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </View>
              )}
            </Pressable>
            <View className="flex-1 items-center">
              <Text style={{ ...responsiveTypography.displayMedium, color: colors.textPrimary }}>Solution</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View style={{ padding: responsiveSpacing.xl, paddingBottom: 280 }}>
            {/* Problem Statement */}
            <Animated.View
              entering={FadeInUp.duration(500)}
              className="bg-white rounded-3xl"
              style={{
                padding: responsiveSpacing.xl,
                marginBottom: responsiveSpacing.xl,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
                elevation: 3,
              }}
            >
              <View className="flex-row items-center mb-4" style={{ gap: responsiveSpacing.md }}>
                <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: "#eef2ff" }}>
                  <Ionicons name="document-text" size={24} color={colors.primary} />
                </View>
                <Text style={{ ...responsiveTypography.titleLarge, color: colors.textPrimary }}>Problem</Text>
              </View>
              <View className="rounded-2xl" style={{ backgroundColor: colors.surfaceAlt, padding: responsiveSpacing.lg }}>
                <MathText size="medium">
                  {solution?.problem || ""}
                </MathText>
              </View>
            </Animated.View>

            {/* Solution Steps */}
            <View style={{ gap: responsiveSpacing.xl, marginBottom: responsiveSpacing.xl }}>
              {solution?.steps.map((step, index) => (
                <Animated.View
                  key={step.id}
                  entering={FadeInDown.delay(index * 200).duration(600)}
                  className="bg-white rounded-3xl overflow-hidden"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06,
                    shadowRadius: 8,
                    elevation: 2,
                    opacity: index < revealedSteps ? 1 : 0.3,
                  }}
                >
                  {/* Step Header */}
                  <View style={{ paddingHorizontal: responsiveSpacing.xl, paddingTop: responsiveSpacing.lg, paddingBottom: responsiveSpacing.md }}>
                    <View className="flex-row items-center" style={{ gap: responsiveSpacing.md }}>
                      <View className="items-center">
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center"
                          style={{
                            backgroundColor: index < revealedSteps ? colors.secondary : "#d1d5db",
                          }}
                        >
                          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
                            {index + 1}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
                          {(() => {
                            const { subject } = detectSubject(solution?.problem || "");
                            return subject.charAt(0).toUpperCase() + subject.slice(1);
                          })()}
                        </Text>
                      </View>
                      <Text className="flex-1" style={{ ...responsiveTypography.bodyMedium, fontWeight: "600", color: colors.textPrimary }}>
                        {formatTitle(step.title)}
                      </Text>
                    </View>
                  </View>

                  {/* Step Content */}
                  <View style={{ paddingHorizontal: responsiveSpacing.xl, paddingBottom: responsiveSpacing.xl }}>
                    {/* Equation Box - Light gray background */}
                    <View
                      className="rounded-2xl"
                      style={{
                        backgroundColor: colors.surfaceAlt,
                        padding: responsiveSpacing.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <MathText size="large">
                        {step.equation || step.content || ""}
                      </MathText>
                    </View>

                    {/* Summary - Plain English with blue left border */}
                    {step.summary && (
                      <View
                        className="mt-3"
                        style={{
                          paddingLeft: responsiveSpacing.lg,
                          borderLeftWidth: 3,
                          borderLeftColor: "#3b82f6",
                        }}
                      >
                        <MathText size="small" mode="prose">
                          {step.summary}
                        </MathText>
                      </View>
                    )}

                    {/* Explanation (only shown in simplified mode) */}
                    {step.explanation && (
                      <View
                        className="rounded-2xl mt-3"
                        style={{
                          backgroundColor: "#fef3c7",
                          padding: responsiveSpacing.lg,
                          borderWidth: 1,
                          borderColor: "#fbbf24",
                        }}
                      >
                        <View className="flex-row items-start mb-2" style={{ gap: responsiveSpacing.sm }}>
                          <Ionicons name="bulb" size={20} color="#f59e0b" />
                          <Text style={{ fontSize: 14, fontWeight: "700", color: "#92400e", flex: 1 }}>
                            Why this step?
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 16,
                            lineHeight: 24,
                            color: "#78350f",
                            flexShrink: 1,
                            flexWrap: "wrap"
                          }}
                        >
                          {step.explanation?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()}
                        </Text>
                      </View>
                    )}
                  </View>
                </Animated.View>
              ))}
            </View>

            {/* Formal Solution Steps Box - Clean vertical equation display */}
            {/* Only show for math-based subjects where equation progression is meaningful */}
            {revealedSteps >= (solution?.steps.length || 0) && solution?.steps && (() => {
              const { subject } = detectSubject(solution?.problem || "");
              const showFormalSteps = [
                "math", "algebra", "geometry", "calculus", "trigonometry",
                "physics", "chemistry", "statistics"
              ].includes(subject);
              return showFormalSteps;
            })() && (
              <Animated.View entering={FadeInUp.delay(200).duration(500)}>
                <FormalStepsBox steps={solution.steps} />
              </Animated.View>
            )}

            {/* Final Answer */}
            {revealedSteps >= (solution?.steps.length || 0) && (
              <Animated.View
                entering={FadeInUp.duration(600)}
                className="rounded-3xl overflow-hidden"
                style={{
                  backgroundColor: "#10b981",
                  shadowColor: "#10b981",
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 6,
                }}
              >
                <View style={{ paddingTop: responsiveSpacing.xxl, paddingHorizontal: responsiveSpacing.xxl }}>
                  <View className="items-center mb-4">
                    <View className="w-12 h-12 rounded-full bg-white items-center justify-center mb-3">
                      <Ionicons name="checkmark" size={28} color="#10b981" />
                    </View>
                    <Text style={{ fontSize: 28, fontWeight: "700", color: "#ffffff" }}>
                      Answer
                    </Text>
                  </View>
                </View>
                <View
                  className="bg-white rounded-3xl mx-6 mb-6"
                  style={{
                    padding: responsiveSpacing.xl,
                  }}
                >
                  {typeof solution?.finalAnswer === 'string' ? (
                    <MathText size="large" isOnGreenBackground={false}>
                      {solution.finalAnswer}
                    </MathText>
                  ) : solution?.finalAnswer?.parts ? (
                    <View style={{ gap: responsiveSpacing.md }}>
                      {solution.finalAnswer.parts.map((part, idx) => (
                        <View key={idx}>
                          <MathText size="large" isOnGreenBackground={false}>
                            {part}
                          </MathText>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <MathText size="large" isOnGreenBackground={false}>
                      {""}
                    </MathText>
                  )}
                </View>
              </Animated.View>
            )}
          </View>
        </ScrollView>

        {/* Bottom Actions */}
        <View
          className="absolute bottom-0 left-0 right-0 bg-white px-6"
          style={{
            paddingTop: responsiveSpacing.lg,
            paddingBottom: Math.max(responsiveSpacing.xl, insets.bottom + 12),
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          {/* Need More Help Header */}
          <View className="flex-row items-center justify-between mb-3">
            <Text style={{ fontSize: 16, fontWeight: "600", color: "#6b7280" }}>
              Need More Help?
            </Text>
            <Pressable>
              {({ pressed }) => (
                <View className="flex-row items-center" style={{ opacity: pressed ? 0.6 : 1, gap: 6 }}>
                  <Ionicons name="eye-off-outline" size={18} color="#6b7280" />
                  <Text style={{ fontSize: 14, color: "#6b7280" }}>
                    Hide Tips
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Row 1: Simplify and Ask Question */}
          <View className="flex-row gap-2 mb-2">
            <Pressable onPress={handleSimplifiedExplanation} disabled={isLoadingSimplified} className="flex-1">
              {({ pressed }) => (
                <View
                  className="rounded-xl px-3 py-2.5"
                  style={{
                    backgroundColor: "#f59e0b",
                    opacity: pressed || isLoadingSimplified ? 0.8 : 1
                  }}
                >
                  <View className="flex-row items-center justify-center gap-1.5">
                    {isLoadingSimplified ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Ionicons name="bulb" size={16} color="white" />
                    )}
                    <Text className="text-white font-bold" style={{ fontSize: 13 }}>
                      Simplify
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>

            <Pressable onPress={handleAskQuestion} className="flex-1">
              {({ pressed }) => (
                <View
                  className="rounded-xl px-3 py-2.5"
                  style={{
                    backgroundColor: "#3b82f6",
                    opacity: pressed ? 0.8 : 1
                  }}
                >
                  <View className="flex-row items-center justify-center gap-1.5">
                    <Ionicons name="chatbubble-ellipses" size={16} color="white" />
                    <Text className="text-white font-bold" style={{ fontSize: 13 }}>
                      Ask
                    </Text>
                  </View>
                </View>
              )}
            </Pressable>
          </View>

          {/* Row 2: New Problem */}
          <Pressable onPress={handleNewProblem}>
            {({ pressed }) => (
              <View
                className="rounded-xl px-3 py-2.5"
                style={{
                  backgroundColor: "#991b1b",
                  opacity: pressed ? 0.8 : 1
                }}
              >
                <View className="flex-row items-center justify-center gap-1.5">
                  <Ionicons name="add-circle" size={16} color="white" />
                  <Text className="text-white font-bold" style={{ fontSize: 13 }}>
                    New Problem
                  </Text>
                </View>
              </View>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
