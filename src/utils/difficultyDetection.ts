/**
 * Difficulty and Grade Level Detection Utility
 * Automatically detects the appropriate grade level based on problem complexity
 */

export type GradeLevel = 'elementary' | 'middle' | 'high' | 'college' | 'advanced';

interface DifficultyDetectionResult {
  gradeLevel: GradeLevel;
  confidence: number;
  vocabularyGuidance: string;
  explanationDepth: string;
}

/**
 * Detects the appropriate grade level based on problem content and complexity
 * @param text - The problem text to analyze
 * @param subject - The detected subject (for context)
 * @returns Grade level with confidence and guidance
 */
export function detectDifficultyLevel(text: string, subject: string): DifficultyDetectionResult {
  const lowerText = text.toLowerCase();
  let elementaryScore = 0;
  let middleScore = 0;
  let highScore = 0;
  let collegeScore = 0;

  // Elementary indicators (K-5: ages 5-11)
  const elementaryKeywords = [
    'add', 'subtract', 'plus', 'minus', 'times', 'divide', 'equal',
    'count', 'number', 'shape', 'color', 'simple', 'basic',
    'what is', 'how many', 'single digit', 'double digit'
  ];

  // Elementary patterns
  const hasSingleDigitMath = /\b[0-9]\s*[+\-×÷]\s*[0-9]\b/.test(text);
  const hasDoubleDigitMath = /\b[1-9][0-9]\s*[+\-×÷]\s*[1-9]?[0-9]\b/.test(text);
  const hasSimpleFractions = /\b(1\/2|1\/3|1\/4|2\/3|3\/4)\b/.test(text);

  // Middle school indicators (6-8: ages 11-14)
  const middleKeywords = [
    'factor', 'multiple', 'prime', 'decimal', 'percent', 'ratio', 'proportion',
    'equation', 'variable', 'exponent', 'square root', 'area', 'perimeter',
    'mean', 'median', 'mode', 'probability', 'integer', 'absolute value',
    'coefficient', 'term', 'expression', 'inequality'
  ];

  // Middle school patterns
  const hasVariables = /\b[a-z]\s*[=+\-×÷]/.test(lowerText) || /[=+\-×÷]\s*[a-z]\b/.test(lowerText);
  const hasSimpleEquations = /\b\d*[a-z]\s*[+\-]\s*\d+\s*=/.test(lowerText);
  const hasPercents = /\d+%|\bpercent\b/.test(lowerText);

  // High school indicators (9-12: ages 14-18)
  const highKeywords = [
    'quadratic', 'polynomial', 'function', 'graph', 'slope', 'intercept',
    'trigonometry', 'sine', 'cosine', 'tangent', 'logarithm', 'exponential',
    'radical', 'rational', 'domain', 'range', 'parabola', 'hyperbola',
    'theorem', 'proof', 'derivative', 'integral', 'limit',
    'vector', 'matrix', 'complex', 'imaginary', 'binomial',
    'molarity', 'stoichiometry', 'equilibrium', 'kinetics', 'thermodynamics',
    'analyze', 'interpret', 'evaluate', 'synthesize', 'compare and contrast'
  ];

  // High school patterns
  const hasComplexFractions = /\{[^}]*\/[^}]*\}.*\{[^}]*\/[^}]*\}/.test(text);
  const hasExponents = /\^[2-9]|\^[a-z]/.test(text);
  const hasMultipleVariables = /[a-z].*[a-z].*=/.test(lowerText) && /[xy]/.test(lowerText);
  const hasTrigFunctions = /sin|cos|tan|sec|csc|cot/.test(lowerText);

  // College/Advanced indicators (18+)
  const collegeKeywords = [
    'calculus', 'differential', 'partial', 'multivariable', 'optimization',
    'linear algebra', 'eigenvector', 'eigenvalue', 'determinant',
    'abstract', 'topology', 'manifold', 'differential equation',
    'quantum', 'relativity', 'thermodynamics', 'statistical mechanics',
    'organic chemistry', 'biochemistry', 'molecular', 'synthesis',
    'epistemology', 'ontology', 'phenomenology', 'hermeneutics',
    'postmodern', 'deconstruction', 'critical theory'
  ];

  // College patterns
  const hasAdvancedNotation = /∫|∂|∇|∑|∏|lim/.test(text);
  const hasGreekLetters = /α|β|γ|δ|ε|θ|λ|μ|π|σ|φ|ψ|ω/.test(text);
  const hasComplexEquations = text.split('=').length > 3; // Multiple equals signs

  // Count keyword matches
  elementaryKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) elementaryScore++;
  });

  middleKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) middleScore++;
  });

  highKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) highScore++;
  });

  collegeKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) collegeScore++;
  });

  // Boost scores based on patterns
  if (hasSingleDigitMath) elementaryScore += 3;
  if (hasDoubleDigitMath && !hasVariables) elementaryScore += 2;
  if (hasSimpleFractions) elementaryScore += 1;

  if (hasVariables && hasSimpleEquations) middleScore += 3;
  if (hasPercents) middleScore += 2;

  if (hasComplexFractions) highScore += 2;
  if (hasExponents) highScore += 2;
  if (hasMultipleVariables) highScore += 2;
  if (hasTrigFunctions) highScore += 3;

  if (hasAdvancedNotation) collegeScore += 4;
  if (hasGreekLetters) collegeScore += 2;
  if (hasComplexEquations) collegeScore += 1;

  // Determine grade level
  const maxScore = Math.max(elementaryScore, middleScore, highScore, collegeScore);

  if (maxScore === 0) {
    // Default based on subject
    if (subject === 'bible' || subject === 'languageArts') {
      return {
        gradeLevel: 'middle',
        confidence: 0.5,
        vocabularyGuidance: 'Use clear, straightforward language appropriate for grades 6-8',
        explanationDepth: 'Provide moderate detail with examples'
      };
    }
    return {
      gradeLevel: 'middle',
      confidence: 0.5,
      vocabularyGuidance: 'Use clear, age-appropriate language',
      explanationDepth: 'Balance detail with accessibility'
    };
  }

  if (collegeScore === maxScore && collegeScore >= 2) {
    return {
      gradeLevel: 'college',
      confidence: Math.min(0.9, 0.6 + (collegeScore * 0.1)),
      vocabularyGuidance: 'Use advanced academic vocabulary, technical terminology, and sophisticated language appropriate for college-level students',
      explanationDepth: 'Provide thorough, rigorous explanations with theoretical foundations and advanced reasoning'
    };
  }

  if (highScore === maxScore && highScore >= 2) {
    return {
      gradeLevel: 'high',
      confidence: Math.min(0.9, 0.6 + (highScore * 0.1)),
      vocabularyGuidance: 'Use formal academic language appropriate for high school students (grades 9-12), introducing technical terms with brief context',
      explanationDepth: 'Provide detailed explanations with logical reasoning, showing connections between concepts'
    };
  }

  if (middleScore === maxScore && middleScore >= 2) {
    return {
      gradeLevel: 'middle',
      confidence: Math.min(0.9, 0.6 + (middleScore * 0.1)),
      vocabularyGuidance: 'Use clear, accessible language appropriate for middle school students (grades 6-8), defining new terms when introduced',
      explanationDepth: 'Break down concepts into digestible steps, using relatable examples and avoiding overly technical language'
    };
  }

  if (elementaryScore === maxScore && elementaryScore >= 2) {
    return {
      gradeLevel: 'elementary',
      confidence: Math.min(0.9, 0.6 + (elementaryScore * 0.1)),
      vocabularyGuidance: 'Use simple, concrete language appropriate for elementary students (grades K-5), avoiding technical jargon entirely',
      explanationDepth: 'Keep explanations very simple and concrete, using visual descriptions and everyday examples'
    };
  }

  // Default to middle school if unclear
  return {
    gradeLevel: 'middle',
    confidence: 0.6,
    vocabularyGuidance: 'Use clear, accessible language appropriate for middle school students',
    explanationDepth: 'Provide balanced explanations with step-by-step guidance'
  };
}

/**
 * Get grade-appropriate instruction style
 */
export function getGradeAppropriateInstructions(gradeLevel: GradeLevel): string {
  switch (gradeLevel) {
    case 'elementary':
      return `
**GRADE LEVEL: ELEMENTARY (K-5)**
- Use VERY SIMPLE words that a 5-11 year old would understand
- Avoid ALL technical jargon and big words
- Use short sentences and very clear explanations
- Relate concepts to everyday things kids understand (toys, snacks, playground, etc.)
- Be encouraging and enthusiastic
- Example: Instead of "subtract the addend", say "take away the number"`;

    case 'middle':
      return `
**GRADE LEVEL: MIDDLE SCHOOL (6-8)**
- Use clear language appropriate for 11-14 year olds
- Define technical terms when you introduce them
- Use moderate sentence length and clear structure
- Relate to middle school experiences (sports, social media, school activities)
- Build confidence while challenging understanding
- Example: "The coefficient is the number in front of the variable (the letter)"`;

    case 'high':
      return `
**GRADE LEVEL: HIGH SCHOOL (9-12)**
- Use formal academic language appropriate for 14-18 year olds
- Assume familiarity with basic technical terms, introduce advanced ones
- Use detailed explanations with logical progression
- Make connections to real-world applications (careers, current events, technology)
- Encourage analytical and critical thinking
- Example: "Apply the quadratic formula to find the roots of the equation"`;

    case 'college':
      return `
**GRADE LEVEL: COLLEGE/ADVANCED (18+)**
- Use sophisticated academic vocabulary and technical terminology
- Assume strong foundational knowledge
- Provide rigorous, theoretically grounded explanations
- Reference advanced concepts, theorems, and methodologies
- Encourage independent reasoning and synthesis
- Example: "Utilize the eigenvalue decomposition to diagonalize the matrix"`;

    default:
      return `
**GRADE LEVEL: MIDDLE SCHOOL (DEFAULT)**
- Use clear, accessible language
- Balance detail with understandability
- Provide step-by-step guidance with explanations`;
  }
}
