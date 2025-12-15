/**
 * TestBot - Standalone Test Runner
 *
 * This version can run independently without React Native dependencies
 */

import { OpenAI } from "openai";

// Initialize OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Test problem structure (same as before)
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
}

interface EvaluationResult {
  problemId: string;
  subject: string;
  grades: {
    accuracy: { score: number; feedback: string };
    clarity: { score: number; feedback: string };
    formatting: { score: number; feedback: string };
    pedagogy: { score: number; feedback: string };
    overall: number;
  };
  critiques: string[];
  recommendations: Recommendation[];
  solutionOutput: any;
}

// Test problems
const TEST_PROBLEMS: TestProblem[] = [
  // 1. ALGEBRA
  {
    id: "algebra-001",
    subject: "Algebra",
    difficulty: "Grade 8-9",
    problemText: "Solve for x: 5x - 8 = 3x + 12",
    expectedConcepts: ["equation solving", "combining like terms", "inverse operations"],
    evaluationCriteria: {
      accuracy: [
        "Correct final answer (x = 10)",
        "All algebraic steps are mathematically correct",
        "No arithmetic errors"
      ],
      clarity: [
        "Shows original equation first",
        "Each operation is clearly labeled (e.g., 'Subtract 3x from both sides')",
        "Intermediate steps are displayed",
        "Logical flow from start to finish"
      ],
      formatting: [
        "Variables in italics (*x*)",
        "Each step on separate line with line breaks",
        "Red highlighting on final answer",
        "Consistent font sizes throughout",
        "Proper spacing between steps"
      ],
      pedagogy: [
        "Step-by-step progression matches grade level",
        "Explanations use age-appropriate language",
        "Builds understanding, not just showing answer",
        "Plain English summaries explain what each step accomplishes"
      ]
    }
  },

  // 2. PHYSICS
  {
    id: "physics-001",
    subject: "Physics",
    difficulty: "High School",
    problemText: "A 2.5 kg object is accelerating at 4 m/s². What net force is acting on it?",
    expectedConcepts: ["Newton's second law", "force calculation", "units"],
    evaluationCriteria: {
      accuracy: [
        "Correct final answer (10 N)",
        "Proper use of F = ma formula",
        "Correct units (Newtons)"
      ],
      clarity: [
        "Formula stated before calculation",
        "Values clearly substituted into formula",
        "Calculation steps shown",
        "Answer includes units"
      ],
      formatting: [
        "Variables in italics (*F*, *m*, *a*)",
        "Red highlighting on final numerical result",
        "Subscripts properly formatted if used",
        "Units formatted correctly (m/s²)",
        "Diagram included if applicable"
      ],
      pedagogy: [
        "Identifies which law applies and why",
        "Explains physical meaning of result",
        "Plain English summary explains what we calculated"
      ]
    }
  },

  // 3. CHEMISTRY
  {
    id: "chemistry-001",
    subject: "Chemistry",
    difficulty: "High School",
    problemText: "Balance the equation: C₃H₈ + O₂ → CO₂ + H₂O",
    expectedConcepts: ["balancing equations", "conservation of mass", "stoichiometry"],
    evaluationCriteria: {
      accuracy: [
        "Correctly balanced equation (C₃H₈ + 5O₂ → 3CO₂ + 4H₂O)",
        "All elements have equal atoms on both sides",
        "Coefficients in lowest terms"
      ],
      clarity: [
        "Shows systematic balancing approach",
        "Counts atoms for each element",
        "Verifies balance at the end"
      ],
      formatting: [
        "Subscripts properly formatted (C_3_H_8_)",
        "Reaction arrow displayed correctly (→)",
        "Chemical formulas formatted properly",
        "Red highlighting on final balanced equation"
      ],
      pedagogy: [
        "Explains why we balance equations",
        "Shows which element to balance first and why",
        "Verification step confirms understanding"
      ]
    }
  },

  // 4. STATISTICS
  {
    id: "statistics-001",
    subject: "Statistics",
    difficulty: "College",
    problemText: "A sample of 40 students has a mean test score of 78 with a standard deviation of 12. Construct a 95% confidence interval for the population mean.",
    expectedConcepts: ["confidence intervals", "t-distribution", "standard error"],
    evaluationCriteria: {
      accuracy: [
        "Correct confidence interval calculation",
        "Proper use of t-distribution (not z)",
        "Correct degrees of freedom (39)",
        "Accurate standard error calculation"
      ],
      clarity: [
        "Identifies what type of problem (confidence interval)",
        "States formula before calculation",
        "Shows all calculation steps",
        "Interprets result in context"
      ],
      formatting: [
        "Greek letters as words (not LaTeX: 'alpha' not '\\alpha')",
        "Fractions using {numerator/denominator} syntax",
        "Each calculation step on separate line",
        "Red highlighting on final interval",
        "Consistent font sizes"
      ],
      pedagogy: [
        "Explains why t-distribution is used",
        "Shows how to find t-critical value",
        "Interprets meaning of confidence interval"
      ]
    }
  },

  // 5. BIOLOGY (Multiple Choice)
  {
    id: "biology-001",
    subject: "Biology",
    difficulty: "High School",
    problemText: `Which organelle is responsible for cellular respiration?
A. Nucleus
B. Mitochondria
C. Chloroplast
D. Ribosome`,
    expectedConcepts: ["cell organelles", "mitochondria function", "cellular respiration"],
    evaluationCriteria: {
      accuracy: [
        "Identifies correct answer (B. Mitochondria)",
        "Explanation is scientifically accurate",
        "Correctly explains why other options are wrong"
      ],
      clarity: [
        "Each answer choice on separate line in problem statement",
        "Each option analyzed on separate line in solution",
        "Clear identification of correct vs incorrect answers"
      ],
      formatting: [
        "List items (A, B, C, D) each on own line",
        "No underscores in list markers (B. not B_.)",
        "Correct answers highlighted in red",
        "Incorrect answers highlighted in blue",
        "Consistent font sizes across all options"
      ],
      pedagogy: [
        "Explains function of mitochondria",
        "Brief explanation why other organelles are incorrect",
        "Helps student understand concept, not just memorize"
      ]
    }
  }
];

async function generateSolution(problem: TestProblem): Promise<any> {
  const prompt = `You are an expert educator. Provide a clean, easy-to-follow solution.

**DETECTED SUBJECT: ${problem.subject.toUpperCase()}**

**CRITICAL FORMATTING RULES**:
1. ALL fractions MUST use {numerator/denominator} syntax
2. Subscripts: Use text_subscript_ format
3. Superscripts: Use text^superscript^ format
4. Variables in italics: *variable*
5. Each step on separate line with line breaks for multi-step calculations
6. RED highlighting for final answers: [red:answer]
7. BLUE highlighting for values from previous steps used in current step
8. For algebra: Show original equation, then each operation with intermediate steps
9. For multiple choice: Put each option (A, B, C, D) on its own line
10. NO underscores in list markers (use "A." not "A_.")

Question: ${problem.problemText}

**JSON Response Format**:
{
  "problem": "Restate the problem clearly",
  "steps": [
    {
      "title": "Clear action title",
      "equation": "Mathematical work with proper formatting",
      "summary": "Plain English explanation"
    }
  ],
  "finalAnswer": "Answer with [red:highlighting]"
}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const responseContent = completion.choices[0]?.message?.content || "{}";

  try {
    return JSON.parse(responseContent);
  } catch (error) {
    console.error("Failed to parse solution:", error);
    return { error: "Failed to generate solution", rawResponse: responseContent };
  }
}

async function evaluateSolution(problem: TestProblem, solution: any): Promise<EvaluationResult> {
  const evaluationPrompt = `You are an expert educational content evaluator. Evaluate this homework solution across multiple dimensions.

**PROBLEM**: ${problem.problemText}
**SUBJECT**: ${problem.subject}
**DIFFICULTY**: ${problem.difficulty}

**GENERATED SOLUTION**:
${JSON.stringify(solution, null, 2)}

**EVALUATION CRITERIA**:

**ACCURACY** (Score 0-100):
${problem.evaluationCriteria.accuracy.map(c => `- ${c}`).join('\n')}

**CLARITY** (Score 0-100):
${problem.evaluationCriteria.clarity.map(c => `- ${c}`).join('\n')}

**FORMATTING** (Score 0-100):
${problem.evaluationCriteria.formatting.map(c => `- ${c}`).join('\n')}

**PEDAGOGY** (Score 0-100):
${problem.evaluationCriteria.pedagogy.map(c => `- ${c}`).join('\n')}

Provide a comprehensive evaluation with:
1. Numeric scores (0-100) for each category
2. Specific feedback for what was done well
3. Specific critiques for what needs improvement
4. Actionable recommendations for code changes

Respond in JSON format:
{
  "accuracy": { "score": 0-100, "feedback": "detailed feedback", "issues": ["specific issues"] },
  "clarity": { "score": 0-100, "feedback": "detailed feedback", "issues": ["specific issues"] },
  "formatting": { "score": 0-100, "feedback": "detailed feedback", "issues": ["specific issues"] },
  "pedagogy": { "score": 0-100, "feedback": "detailed feedback", "issues": ["specific issues"] },
  "overallScore": 0-100,
  "critiques": ["critique 1", "critique 2", ...],
  "recommendations": [
    {
      "priority": "HIGH|MEDIUM|LOW",
      "category": "accuracy|clarity|formatting|pedagogy",
      "issue": "description of issue",
      "recommendation": "specific code or prompt change needed",
      "files": ["file1.ts", "file2.ts"]
    }
  ]
}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: evaluationPrompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const evaluationContent = completion.choices[0]?.message?.content || "{}";
  const evaluation = JSON.parse(evaluationContent);

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

function generateTestReport(results: EvaluationResult[]): string {
  const totalScore = results.reduce((sum, r) => sum + r.grades.overall, 0) / results.length;

  let report = `
╔═══════════════════════════════════════════════════════════════╗
║                         TESTBOT REPORT                        ║
║                   Automated Quality Evaluation                ║
╚═══════════════════════════════════════════════════════════════╝

Test Date: ${new Date().toISOString()}
Problems Tested: ${results.length}
Overall Score: ${totalScore.toFixed(1)}/100

═══════════════════════════════════════════════════════════════

INDIVIDUAL PROBLEM RESULTS:
`;

  results.forEach((result, index) => {
    report += `
─────────────────────────────────────────────────────────────
${index + 1}. ${result.subject.toUpperCase()} (${result.problemId})
─────────────────────────────────────────────────────────────

SCORES:
  • Accuracy:   ${result.grades.accuracy.score}/100
  • Clarity:    ${result.grades.clarity.score}/100
  • Formatting: ${result.grades.formatting.score}/100
  • Pedagogy:   ${result.grades.pedagogy.score}/100
  • OVERALL:    ${result.grades.overall}/100

FEEDBACK:
  Accuracy:   ${result.grades.accuracy.feedback}
  Clarity:    ${result.grades.clarity.feedback}
  Formatting: ${result.grades.formatting.feedback}
  Pedagogy:   ${result.grades.pedagogy.feedback}

CRITIQUES:
${result.critiques.map(c => `  ⚠ ${c}`).join('\n')}

`;
  });

  // Aggregate recommendations by priority
  const allRecommendations = results.flatMap(r => r.recommendations);
  const highPriority = allRecommendations.filter(r => r.priority === 'HIGH');
  const mediumPriority = allRecommendations.filter(r => r.priority === 'MEDIUM');
  const lowPriority = allRecommendations.filter(r => r.priority === 'LOW');

  report += `
═══════════════════════════════════════════════════════════════

RECOMMENDATIONS FOR IMPROVEMENT:

🔴 HIGH PRIORITY (${highPriority.length}):
${highPriority.map((r, i) => `
${i + 1}. [${r.category.toUpperCase()}] ${r.issue}
   → ${r.recommendation}
   Files: ${r.files.join(', ')}
`).join('')}

🟡 MEDIUM PRIORITY (${mediumPriority.length}):
${mediumPriority.map((r, i) => `
${i + 1}. [${r.category.toUpperCase()}] ${r.issue}
   → ${r.recommendation}
   Files: ${r.files.join(', ')}
`).join('')}

🟢 LOW PRIORITY (${lowPriority.length}):
${lowPriority.map((r, i) => `
${i + 1}. [${r.category.toUpperCase()}] ${r.issue}
   → ${r.recommendation}
   Files: ${r.files.join(', ')}
`).join('')}

═══════════════════════════════════════════════════════════════

SUMMARY:
Total Issues Found: ${allRecommendations.length}
Average Score: ${totalScore.toFixed(1)}/100
Status: ${totalScore >= 90 ? '✅ EXCELLENT' : totalScore >= 75 ? '✓ GOOD' : totalScore >= 60 ? '⚠ NEEDS IMPROVEMENT' : '❌ REQUIRES ATTENTION'}

═══════════════════════════════════════════════════════════════
`;

  return report;
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                         🤖 TESTBOT                            ║
║            Automated Testing & Evaluation System              ║
╚═══════════════════════════════════════════════════════════════╝
`);

  console.log("🤖 TestBot starting automated evaluation...");
  console.log(`Testing 5 problems across 5 subjects...\n`);

  const results: EvaluationResult[] = [];

  for (const problem of TEST_PROBLEMS) {
    console.log(`📝 Testing ${problem.subject}: ${problem.id}`);
    console.log(`   Problem: ${problem.problemText.substring(0, 60)}...`);

    try {
      console.log("   ⚙️  Generating solution...");
      const solution = await generateSolution(problem);

      if (solution.error) {
        console.log("   ❌ Solution generation failed");
        continue;
      }

      console.log("   📊 Evaluating solution...");
      const evaluation = await evaluateSolution(problem, solution);
      results.push(evaluation);

      console.log(`   ✅ Completed - Score: ${evaluation.grades.overall}/100\n`);
    } catch (error) {
      console.error(`   ❌ Error testing ${problem.id}:`, error);
    }
  }

  const report = generateTestReport(results);
  console.log('\n' + report);

  const avgScore = results.reduce((sum, r) => sum + r.grades.overall, 0) / results.length;

  if (avgScore >= 90) {
    console.log('\n🎉 EXCELLENT! All tests passed with high scores.');
  } else if (avgScore >= 75) {
    console.log('\n✅ GOOD! Tests passed but some improvements recommended.');
  } else if (avgScore >= 60) {
    console.log('\n⚠️  NEEDS IMPROVEMENT! Please review recommendations.');
  } else {
    console.log('\n❌ REQUIRES ATTENTION! Significant issues found.');
  }
}

main().catch(console.error);
