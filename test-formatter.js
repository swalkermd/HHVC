// Test the formatter logic
const testInput = `*y* = *m**x* + *b* 
*y* = -{3/7}*x* + 2 → [red:*y* = -{3/7}*x* + 2]`;

console.log("Input:", testInput);
console.log("\n--- Testing color tag line break fix ---");

let result = testInput;
let prevResult = '';
let iterations = 0;
while (prevResult !== result && iterations < 10) {
  prevResult = result;
  result = result.replace(/(\[(?:red|blue|green|orange|purple|yellow):[^\]\n]*)\n([^\]]*)/gi, '$1 $2');
  iterations++;
  if (prevResult !== result) {
    console.log(`Iteration ${iterations}:`, result);
  }
}

console.log("\nFinal result:", result);
console.log("Iterations:", iterations);
