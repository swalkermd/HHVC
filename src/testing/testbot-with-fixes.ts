/**
 * TestBot - Automated Testing with Auto-Fix
 *
 * Runs tests, evaluates output, and automatically applies code improvements
 */

import { OpenAI } from "openai";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env file
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
}

const client = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY,
});

interface TestProblem {
  id: string;
  subject: string;
  difficulty: string;
  problemText: string;
  expectedConcepts: string[];
  evaluationCriteria: {
    accuracy: string[];
    clarity: string[];
    formatting: string[];
    pedagogy: string[];
  };
}

interface Recommendation {
  priority: "HIGH" | "MEDIUM" | "LOW";
  category: "accuracy" | "clarity" | "formatting" | "pedagogy";
  issue: string;
  recommendation: string;
  files: string[];
  codeChange?: {
    file: string;
    description: string;
    searchPattern: string;
    replacement: string;
  };
}

interface EvaluationResult {
  problemId: string;
  subject: string;
  grades: {
    accuracy: { score: number; feedback: string; issues: string[] };
    clarity: { score: number; feedback: string; issues: string[] };
    formatting: { score: number; feedback: string; issues: string[] };
    pedagogy: { score: number; feedback: string; issues: string[] };
    overall: number;
  };
  critiques: string[];
  recommendations: Recommendation[];
  solutionOutput: any;
}

// Configuration for dynamic question generation
const TEST_CONFIG = {
  numberOfQuestions: 5, // Number of questions to generate per test run
  subjectPool: [
    // STEM subjects for this run - diverse sciences
    "Physics", "Chemistry", "Biology", "Calculus", "Statistics"
  ],
  questionTypes: [
    "calculation", // Standard math/science calculation
    "multiple_choice", // Multiple choice with 4 options
    "short_answer", // Brief written response
    "essay", // Longer written response (paragraph)
    "fill_in_blank", // Complete the sentence/equation
    "true_false", // True/False with explanation
    "graphing", // Requires graph interpretation or creation
    "matching", // Match terms to definitions
  ],
  difficultyLevels: ["Elementary", "Middle School", "High School", "College"]
};

/**
 * Dynamically generate a test question using AI
 * This creates novel questions across diverse subjects and formats
 */
async function generateTestQuestion(): Promise<TestProblem> {
  // Randomly select subject, question type, and difficulty
  const subject = TEST_CONFIG.subjectPool[Math.floor(Math.random() * TEST_CONFIG.subjectPool.length)];
  const questionType = TEST_CONFIG.questionTypes[Math.floor(Math.random() * TEST_CONFIG.questionTypes.length)];
  const difficulty = TEST_CONFIG.difficultyLevels[Math.floor(Math.random() * TEST_CONFIG.difficultyLevels.length)];

  const generationPrompt = `You are an expert educator creating homework questions.

**TASK**: Generate a ${difficulty} level ${subject} question in ${questionType} format.

**QUESTION TYPE REQUIREMENTS**:
${questionType === "calculation" ? "- Include specific numbers and require step-by-step mathematical/scientific work\n- Must have a definitive numerical or calculable answer" : ""}
${questionType === "multiple_choice" ? "- Provide 4 answer options (A, B, C, D)\n- Only one option should be correct\n- Include the correct answer in your response" : ""}
${questionType === "short_answer" ? "- Should be answerable in 1-3 sentences\n- Requires conceptual understanding, not just recall" : ""}
${questionType === "essay" ? "- Requires analysis, synthesis, or argumentation\n- Should prompt 1-2 paragraph response\n- Include specific aspects to address" : ""}
${questionType === "fill_in_blank" ? "- Include 1-3 blanks to fill\n- Can be words, equations, or short phrases\n- Context should guide the answer" : ""}
${questionType === "true_false" ? "- Present a statement\n- Require explanation of why it is true or false" : ""}
${questionType === "graphing" ? "- Require graph interpretation OR creation\n- Include specific data points or functions" : ""}
${questionType === "matching" ? "- Provide 4-6 items to match\n- Terms to definitions, events to dates, etc." : ""}

**SUBJECT-SPECIFIC GUIDANCE**:
${subject.includes("Math") || ["Algebra", "Geometry", "Trigonometry", "Calculus", "Statistics"].includes(subject) ? "- Use proper mathematical notation\n- Include specific values" : ""}
${["Physics", "Chemistry", "Biology", "Engineering"].includes(subject) ? "- Include relevant formulas or concepts\n- Use appropriate scientific notation" : ""}
${["English", "Writing"].some(s => subject.includes(s)) ? "- Reference specific literary techniques or grammar rules\n- May reference well-known texts or authors" : ""}
${["History", "Geography"].includes(subject) ? "- Reference specific events, dates, or locations\n- Focus on cause-effect or significance" : ""}
${["Spanish", "French"].includes(subject) ? "- Test vocabulary, grammar, or translation\n- Use authentic language examples" : ""}

Respond in JSON format:
{
  "id": "unique-id-${Date.now()}",
  "subject": "${subject}",
  "questionType": "${questionType}",
  "difficulty": "${difficulty}",
  "problemText": "The full question text (be creative and realistic)",
  "correctAnswer": "Expected answer or solution approach (if applicable)",
  "expectedConcepts": ["concept1", "concept2", "concept3"],
  "evaluationCriteria": {
    "accuracy": ["criterion1", "criterion2", "criterion3"],
    "clarity": ["criterion1", "criterion2"],
    "formatting": ["criterion1", "criterion2"],
    "pedagogy": ["criterion1", "criterion2"]
  }
}

**IMPORTANT**:
- Make the question realistic and appropriate for the difficulty level
- Evaluation criteria should be SPECIFIC to this exact question
- Accuracy criteria should include the correct answer or solution steps
- For multiple choice, include which option is correct (A/B/C/D) in accuracy criteria
- Be creative and varied - avoid repetitive question patterns`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: generationPrompt }],
    response_format: { type: "json_object" },
    temperature: 0.9, // Higher temperature for more variety
  });

  const generated = JSON.parse(completion.choices[0]?.message?.content || "{}");

  // Ensure all required fields are present
  return {
    id: generated.id || `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    subject: generated.subject || subject,
    difficulty: generated.difficulty || difficulty,
    problemText: generated.problemText,
    expectedConcepts: generated.expectedConcepts || [],
    evaluationCriteria: generated.evaluationCriteria || {
      accuracy: [],
      clarity: [],
      formatting: [],
      pedagogy: []
    }
  };
}

function getSubjectGuidance(subject: string): string {
  const guidance: Record<string, string> = {
    "Chemistry": "Calculate molar mass step-by-step. Explain what a mole represents. Use subscripts for formulas (H_2_O).",
    "Physics": "Explain the physical concept first. State force directions explicitly. Include units throughout.",
    "Biology": "Show Punnett square as a clear grid. Explain dominant vs recessive alleles. Calculate ratios then percentages.",
    "Calculus": "State the rule before applying it. Show derivative of each term separately. Include a concluding summary.",
    "Engineering": "Explain technical terms before using them. Show all given values. Add practical context.",
    "Algebra": "Show EVERY transformation step with intermediate results.",
    "Statistics": "Sort data first. For median with even n, average the two middle values.",
    "Geometry": "Explain what you're calculating. Show formula substitution clearly.",
    "Trigonometry": "Explain why you're using the specific trig function. State to use degree mode."
  };
  return guidance[subject] || "Follow standard pedagogical practices for this subject.";
}

async function generateSolution(problem: TestProblem): Promise<any> {
  // CRITICAL: Replicate the ACTUAL app's solution generation logic
  // This ensures we're testing the real app prompts, formatting rules, and subject detection
  // We can't import from SolutionScreen.tsx due to React Native dependencies,
  // so we replicate the core logic here

  try {
    // Import only Node-compatible modules
    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({
      apiKey: process.env.EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY,
    });

    // Detect subject (simplified version of app's detectSubject logic)
    const questionLower = problem.problemText.toLowerCase();
    let subject = problem.subject; // Use the subject from generated question

    // Subject-specific formatting rules (from app's getSubjectFormattingRules)
    const formattingRulesMap: Record<string, string> = {
      "Chemistry": "Use subscripts for chemical formulas (H_2_O). Show molar mass calculations step-by-step.",
      "Physics": "State force directions explicitly. Include units throughout. Use subscripts for variables (F_net_).",
      "Biology": "Show Punnett squares as clear grids. Explain genotypes and phenotypes.",
      "Calculus": "State rules before applying. Show derivative of each term separately.",
      "Engineering": "Explain technical terms before using them. Show all given values.",
      "Algebra": "Show EVERY transformation step with intermediate results.",
      "Statistics": "Sort data first. For median with even n, average the two middle values.",
      "Geometry": "Explain what you're calculating. Show formula substitution clearly.",
      "Trigonometry": "Explain why you're using the specific trig function. State to use degree mode.",
      "English Literature": "Quote specific passages. Analyze literary techniques.",
      "English Grammar": "Identify parts of speech. Explain grammar rules.",
      "World History": "Reference specific dates and events. Explain cause-effect relationships.",
      "US History": "Reference specific documents, dates, and figures. Explain significance.",
      "Geography": "Reference specific locations. Explain spatial relationships.",
      "Spanish": "Provide translations. Explain grammar rules in context.",
      "French": "Provide translations. Explain grammar rules in context.",
      "Psychology": "Reference theories and researchers. Explain concepts clearly.",
      "Sociology": "Reference social theories. Explain societal patterns.",
      "Economics": "Explain economic principles. Use graphs when appropriate."
    };

    const formattingRules = formattingRulesMap[subject] || "Follow standard pedagogical practices.";

    // Grade-appropriate instructions (simplified from app's getGradeAppropriateInstructions)
    const difficultyLevel = problem.difficulty || "High School";
    let gradeInstructions = "";
    if (difficultyLevel.includes("Elementary")) {
      gradeInstructions = "Use simple language. Explain every concept. Break down into very small steps.";
    } else if (difficultyLevel.includes("Middle")) {
      gradeInstructions = "Use clear language. Explain key concepts. Show step-by-step work.";
    } else if (difficultyLevel.includes("High")) {
      gradeInstructions = "Use precise terminology. Explain reasoning. Show all work.";
    } else {
      gradeInstructions = "Use technical language. Expect conceptual understanding. Show rigorous work.";
    }

    // This is the EXACT SAME prompt structure the app uses
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `You are an expert educator. Provide a clean, easy-to-follow solution.

**DETECTED SUBJECT: ${subject.toUpperCase()}**

**CRITICAL: Two-Part Step Structure**
Each step MUST have TWO components:
1. "equation": The work (equations, calculations, analysis, or content)
2. "summary": A single plain-English sentence explaining what we're doing

**SUBJECT-SPECIFIC GUIDANCE**:
${formattingRules}

**GRADE/DIFFICULTY LEVEL**: ${difficultyLevel}
${gradeInstructions}

Question: ${problem.problemText}

**CRITICAL FORMATTING RULES**:
1. Variables in italics: *v*, *x*, *F*
2. Subscripts: v_peri_, F_net_
3. Superscripts: x^2^, m^3^
4. Fractions: {numerator/denominator}
5. Color highlighting:
   - [red:final answer or key result]
   - [blue:values from previous steps]

Respond with JSON matching this structure:
{
  "problem": "Restate the problem clearly",
  "steps": [
    {
      "title": "Step title",
      "equation": "The work, equations, or analysis",
      "summary": "Plain English explanation of what we did"
    }
  ],
  "finalAnswer": "The final answer with appropriate formatting"
}

**IMPORTANT**: For non-calculation questions (essays, short answers, true/false, etc.):
- Use the "equation" field for the main content/analysis
- Use the "summary" field for meta-commentary about the reasoning
- Adapt the structure to fit the question type`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const responseContent = completion.choices[0]?.message?.content || "{}";
    return JSON.parse(responseContent);
  } catch (error) {
    console.error("Error generating solution:", error);
    throw error;
  }
}

async function evaluateSolution(problem: TestProblem, solution: any): Promise<EvaluationResult> {
  const evaluationPrompt = `You are an expert educational content evaluator. Evaluate this homework solution.

**PROBLEM**: ${problem.problemText}
**SUBJECT**: ${problem.subject}

**GENERATED SOLUTION**:
${JSON.stringify(solution, null, 2)}

**EVALUATION CRITERIA**:
ACCURACY: ${problem.evaluationCriteria.accuracy.join(', ')}
CLARITY: ${problem.evaluationCriteria.clarity.join(', ')}
FORMATTING: ${problem.evaluationCriteria.formatting.join(', ')}
PEDAGOGY: ${problem.evaluationCriteria.pedagogy.join(', ')}

**IMPORTANT**: When providing file recommendations, use these actual file paths:
- Main solution generation: "src/screens/SolutionScreen.tsx"
- Content formatting: "src/utils/contentFormatter.ts"
- Math text rendering: "src/components/MathText.tsx"
- Subject detection: "src/utils/subjectDetection.ts"

Respond in JSON:
{
  "accuracy": { "score": 0-100, "feedback": "...", "issues": [...] },
  "clarity": { "score": 0-100, "feedback": "...", "issues": [...] },
  "formatting": { "score": 0-100, "feedback": "...", "issues": [...] },
  "pedagogy": { "score": 0-100, "feedback": "...", "issues": [...] },
  "overallScore": 0-100,
  "critiques": [...],
  "recommendations": [
    {
      "priority": "HIGH|MEDIUM|LOW",
      "category": "accuracy|clarity|formatting|pedagogy",
      "issue": "specific description of the problem",
      "recommendation": "detailed fix with code example or prompt instruction",
      "files": ["src/screens/SolutionScreen.tsx"]
    }
  ]
}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: evaluationPrompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const evaluation = JSON.parse(completion.choices[0]?.message?.content || "{}");

  return {
    problemId: problem.id,
    subject: problem.subject,
    grades: {
      accuracy: evaluation.accuracy,
      clarity: evaluation.clarity,
      formatting: evaluation.formatting,
      pedagogy: evaluation.pedagogy,
      overall: evaluation.overallScore,
    },
    critiques: evaluation.critiques,
    recommendations: evaluation.recommendations,
    solutionOutput: solution,
  };
}

interface FileBackup {
  file: string;
  content: string;
}

async function applyCodeFixes(
  recommendations: Recommendation[],
  baselineResults: EvaluationResult[],
  testProblems: TestProblem[]
): Promise<{ applied: number; failed: number; reverted: number; changes: string[] }> {
  let applied = 0;
  let failed = 0;
  let reverted = 0;
  const changes: string[] = [];
  const backups: FileBackup[] = [];

  console.log(`\n🔧 Applying ${recommendations.length} fixes (all priorities) with validation...`);

  // Calculate baseline average score
  const baselineScore = baselineResults.reduce((sum, r) => sum + r.grades.overall, 0) / baselineResults.length;
  console.log(`📊 Baseline Score: ${baselineScore.toFixed(1)}/100`);

  for (const rec of recommendations) {
    try {
      // CRITICAL: Fixes should target the ACTUAL app code in SolutionScreen.tsx
      // Most formatting/pedagogy issues require updating the AI prompts in that file

      // Read the actual file content to provide to the AI
      const targetFile = rec.files[0] || "src/screens/SolutionScreen.tsx";
      const targetFilePath = path.join(process.cwd(), targetFile);
      let fileContext = "";

      if (fs.existsSync(targetFilePath)) {
        const fullContent = fs.readFileSync(targetFilePath, "utf8");
        // Extract just the relevant AI prompt section (lines ~310-750)
        const lines = fullContent.split("\n");
        const promptSection = lines.slice(310, 750).join("\n");
        fileContext = `\n\n**ACTUAL FILE CONTENT (relevant section)**:\n\`\`\`\n${promptSection.substring(0, 3000)}\n\`\`\`\n`;
      }

      const fixPrompt = `You are a code fix expert for the Homework Helper app.

**ISSUE IDENTIFIED**: ${rec.issue}
**RECOMMENDATION**: ${rec.recommendation}
**CATEGORY**: ${rec.category}
**PRIORITY**: ${rec.priority}
**TARGET FILE**: ${targetFile}
${fileContext}
**YOUR TASK**: Generate a specific code change to fix this issue in the AI prompts.

The file contains AI prompts that generate solutions. You need to add/modify instructions.

For FORMATTING issues (like "variables not in italics"):
- Find the "CRITICAL FORMATTING RULES" section
- Add a new rule or strengthen existing ones

For PEDAGOGY issues (like "doesn't explain what a mole is"):
- Find subject-specific guidance sections
- Add explicit requirements

For CLARITY issues:
- Add step-by-step requirements

Return JSON with EXACT text to find and replace:
{
  "file": "${targetFile}",
  "description": "what this fixes",
  "searchPattern": "exact multi-line text from file (3-5 lines for uniqueness)",
  "replacement": "exact replacement including your additions"
}

**CRITICAL**: searchPattern must be EXACT text that exists in the file above. Copy it precisely.`;

      const fixCompletion = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: fixPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

      const fix = JSON.parse(fixCompletion.choices[0]?.message?.content || "{}");

      if (fix.file && fix.searchPattern && fix.replacement) {
        const filePath = path.join(process.cwd(), fix.file);

        if (fs.existsSync(filePath)) {
          // Backup original content BEFORE making changes
          const originalContent = fs.readFileSync(filePath, 'utf8');
          backups.push({ file: filePath, content: originalContent });

          if (originalContent.includes(fix.searchPattern)) {
            const modifiedContent = originalContent.replace(fix.searchPattern, fix.replacement);
            fs.writeFileSync(filePath, modifiedContent, 'utf8');

            applied++;
            changes.push(`✅ ${fix.file}: ${fix.description}`);
            console.log(`  ✅ Applied: ${fix.description}`);
          } else {
            failed++;
            console.log(`  ⚠️  Could not find pattern in ${fix.file}`);
          }
        } else {
          failed++;
          console.log(`  ⚠️  File not found: ${fix.file}`);
        }
      }
    } catch (error) {
      failed++;
      console.error(`  ❌ Error applying fix:`, error);
    }
  }

  // CRITICAL: Validate that changes actually improved the output
  if (applied > 0) {
    console.log(`\n🔍 Validating improvements (re-running tests)...`);

    const validationResults: EvaluationResult[] = [];

    // Re-run tests on a subset (first 3 problems for speed)
    for (const problem of testProblems.slice(0, 3)) {
      try {
        const solution = await generateSolution(problem);
        const evaluation = await evaluateSolution(problem, solution);
        validationResults.push(evaluation);
      } catch (error) {
        console.error(`  ⚠️  Validation error for ${problem.id}`);
      }
    }

    const newScore = validationResults.reduce((sum, r) => sum + r.grades.overall, 0) / validationResults.length;
    const scoreDelta = newScore - baselineScore;

    console.log(`📊 Post-Fix Score: ${newScore.toFixed(1)}/100 (${scoreDelta >= 0 ? '+' : ''}${scoreDelta.toFixed(1)})`);

    // If score dropped, ROLLBACK ALL CHANGES
    if (scoreDelta < -2) {  // Allow 2-point tolerance for variance
      console.log(`\n⚠️  DEGRADATION DETECTED! Score dropped by ${Math.abs(scoreDelta).toFixed(1)} points.`);
      console.log(`🔄 Rolling back all changes...`);

      for (const backup of backups) {
        try {
          fs.writeFileSync(backup.file, backup.content, 'utf8');
          reverted++;
        } catch (error) {
          console.error(`  ❌ Failed to restore ${backup.file}`);
        }
      }

      console.log(`✅ Rollback complete. ${reverted} files restored to previous state.`);
      changes.push(`⚠️  ROLLBACK: Changes degraded output quality (score dropped ${Math.abs(scoreDelta).toFixed(1)} points)`);

      return { applied: 0, failed, reverted, changes };
    } else if (scoreDelta > 0) {
      console.log(`✅ Changes IMPROVED output quality!`);
      changes.push(`📈 Quality improvement: +${scoreDelta.toFixed(1)} points`);
    } else {
      console.log(`➡️  Changes had neutral effect on quality.`);
    }
  }

  return { applied, failed, reverted, changes };
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    🤖 TESTBOT AUTO-FIX                        ║
║         Automated Testing, Evaluation & Code Improvement      ║
╚═══════════════════════════════════════════════════════════════╝
`);

  console.log(`📝 Generating ${TEST_CONFIG.numberOfQuestions} diverse test questions...\n`);

  // Phase 0: Generate test questions dynamically
  const testProblems: TestProblem[] = [];

  for (let i = 0; i < TEST_CONFIG.numberOfQuestions; i++) {
    try {
      console.log(`   🎲 Generating question ${i + 1}/${TEST_CONFIG.numberOfQuestions}...`);
      const question = await generateTestQuestion();
      testProblems.push(question);
      console.log(`   ✅ ${question.subject} (${question.difficulty}) - ${question.problemText.substring(0, 60)}...`);
    } catch (error) {
      console.error(`   ❌ Failed to generate question ${i + 1}:`, error);
    }
  }

  console.log(`\n📋 Generated ${testProblems.length} questions. Starting evaluation...\n`);

  const results: EvaluationResult[] = [];

  // Phase 1: Generate and Evaluate
  for (const problem of testProblems) {
    console.log(`\n📋 ${problem.subject}: ${problem.problemText.substring(0, 50)}...`);

    try {
      console.log("   ⚙️  Generating solution...");
      const solution = await generateSolution(problem);

      console.log("   📊 Evaluating solution...");
      const evaluation = await evaluateSolution(problem, solution);
      results.push(evaluation);

      const score = evaluation.grades.overall;
      const emoji = score >= 90 ? '🟢' : score >= 75 ? '🟡' : score >= 60 ? '🟠' : '🔴';
      console.log(`   ${emoji} Score: ${score}/100`);
    } catch (error) {
      console.error(`   ❌ Error:`, error);
    }
  }

  // Phase 2: Generate Summary
  const avgScore = results.reduce((sum, r) => sum + r.grades.overall, 0) / results.length;
  const allRecs = results.flatMap(r => r.recommendations);
  const highPriority = allRecs.filter(r => r.priority === 'HIGH');
  const mediumPriority = allRecs.filter(r => r.priority === 'MEDIUM');
  const lowPriority = allRecs.filter(r => r.priority === 'LOW');
  const allPriorityRecs = [...highPriority, ...mediumPriority, ...lowPriority]; // Apply all fixes

  console.log(`\n
╔═══════════════════════════════════════════════════════════════╗
║                        TEST SUMMARY                           ║
╚═══════════════════════════════════════════════════════════════╝

📊 OVERALL GRADE: ${avgScore.toFixed(1)}/100 ${avgScore >= 90 ? '🎉 EXCELLENT' : avgScore >= 75 ? '✅ GOOD' : avgScore >= 60 ? '⚠️  NEEDS WORK' : '❌ POOR'}

📝 QUESTIONS TESTED:
${results.map((r, i) => `  ${i + 1}. ${r.subject} - Score: ${r.grades.overall}/100`).join('\n')}

🔍 DETAILED SCORES:
${results.map(r => `
  ${r.subject}:
    • Accuracy:   ${r.grades.accuracy.score}/100 ${r.grades.accuracy.issues.length > 0 ? `(${r.grades.accuracy.issues.length} issues)` : '✓'}
    • Clarity:    ${r.grades.clarity.score}/100 ${r.grades.clarity.issues.length > 0 ? `(${r.grades.clarity.issues.length} issues)` : '✓'}
    • Formatting: ${r.grades.formatting.score}/100 ${r.grades.formatting.issues.length > 0 ? `(${r.grades.formatting.issues.length} issues)` : '✓'}
    • Pedagogy:   ${r.grades.pedagogy.score}/100 ${r.grades.pedagogy.issues.length > 0 ? `(${r.grades.pedagogy.issues.length} issues)` : '✓'}
`).join('')}

⚠️  DEFICIENCIES FOUND: ${allRecs.length} total (${highPriority.length} high, ${mediumPriority.length} medium, ${lowPriority.length} low priority)
${allPriorityRecs.slice(0, 10).map((r, i) => `  ${i + 1}. [${r.priority}/${r.category.toUpperCase()}] ${r.issue}`).join('\n')}
${allPriorityRecs.length > 10 ? `  ... and ${allPriorityRecs.length - 10} more` : ''}
`);

  // Phase 3: Apply Fixes (ALL PRIORITIES for 100% accuracy goal)
  if (allPriorityRecs.length > 0) {
    console.log(`\n🔧 Applying fixes for ALL priority levels to achieve 100% accuracy...\n`);
    const { applied, failed, reverted, changes } = await applyCodeFixes(allPriorityRecs, results, testProblems);

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    CODE REVISIONS APPLIED                     ║
╚═══════════════════════════════════════════════════════════════╝

✅ Successfully Applied: ${applied}
❌ Failed: ${failed}
${reverted > 0 ? `🔄 Reverted (due to degradation): ${reverted}` : ''}

📝 CHANGES MADE:
${changes.map(c => `  ${c}`).join('\n')}

${applied > 0 ? '🎉 Code improvements have been automatically applied!' : reverted > 0 ? '⚠️  Changes were reverted due to quality degradation. Manual review needed.' : '⚠️  No automatic fixes could be applied. Manual review needed.'}
`);
  } else {
    console.log(`\n✨ No high-priority issues found! Code quality is excellent.`);
  }

  console.log(`
═══════════════════════════════════════════════════════════════

🏁 TESTBOT COMPLETE
═══════════════════════════════════════════════════════════════
`);
}

main().catch(console.error);
