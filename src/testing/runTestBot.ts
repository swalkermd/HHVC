#!/usr/bin/env ts-node
/**
 * TestBot CLI Runner
 *
 * Simple command-line interface to run TestBot automated testing
 *
 * Usage:
 *   bun run test:bot              # Run all 5 test problems
 *   bun run test:bot --count 3    # Run 3 test problems
 *   bun run test:bot --single algebra-001  # Test single problem
 */

import { runTestBot, testSingleProblem } from './TestBot';

async function main() {
  const args = process.argv.slice(2);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                         🤖 TESTBOT                            ║
║            Automated Testing & Evaluation System              ║
╚═══════════════════════════════════════════════════════════════╝
`);

  try {
    // Check for single problem test
    if (args.includes('--single')) {
      const problemId = args[args.indexOf('--single') + 1];
      if (!problemId) {
        console.error('❌ Error: --single requires a problem ID');
        console.log('Example: bun run test:bot --single algebra-001');
        process.exit(1);
      }

      console.log(`Testing single problem: ${problemId}\n`);
      const result = await testSingleProblem(problemId);

      if (!result) {
        console.error('❌ Test failed');
        process.exit(1);
      }

      console.log('\n✅ Test completed successfully');
      console.log(`Overall Score: ${result.grades.overall}/100`);
      process.exit(0);
    }

    // Check for count parameter
    let count = 5;
    if (args.includes('--count')) {
      const countStr = args[args.indexOf('--count') + 1];
      count = parseInt(countStr, 10);
      if (isNaN(count) || count < 1) {
        console.error('❌ Error: --count must be a positive number');
        process.exit(1);
      }
    }

    // Run full test suite
    const { report, results } = await runTestBot(count);

    console.log('\n' + report);

    const avgScore = results.reduce((sum, r) => sum + r.grades.overall, 0) / results.length;

    if (avgScore >= 90) {
      console.log('\n🎉 EXCELLENT! All tests passed with high scores.');
      process.exit(0);
    } else if (avgScore >= 75) {
      console.log('\n✅ GOOD! Tests passed but some improvements recommended.');
      process.exit(0);
    } else if (avgScore >= 60) {
      console.log('\n⚠️  NEEDS IMPROVEMENT! Please review recommendations.');
      process.exit(1);
    } else {
      console.log('\n❌ REQUIRES ATTENTION! Significant issues found.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ TestBot encountered an error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
