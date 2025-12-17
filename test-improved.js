// Test the improved pattern
const testInput = `[red:y={-3/7}x
+ 2]`;

console.log("Input:", testInput);

let result = testInput;
let prevResult = '';
let iterations = 0;
let maxIterations = 20;

while (prevResult !== result && iterations < maxIterations) {
  prevResult = result;
  result = result.replace(/(\[(?:red|blue|green|orange|purple|yellow):[^\]]*?)\n/gi, '$1 ');
  iterations++;
  if (prevResult !== result) {
    console.log(`Iteration ${iterations}:`, result);
  }
}

console.log("\nFinal:", result);
console.log("Total iterations:", iterations);
